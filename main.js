/* jshint -W097 */
/* jshint strict:false */
/* global require */
/* global RRule */
/* global __dirname */
/* jslint node: true */
'use strict';

var fs = require('fs'); // for storing client key
var utils = require('@iobroker/adapter-core');
var adapter;

var dgram = require('dgram');
var http = require('http');
var net = require('net');

var DOMParser = require('xmldom').DOMParser;
const xml2js = require('xml2js');

let hostUrl, lgtvobj
var pollTimer = null;
var loadedApp = '';
var volume;

if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 

let connected = false;

var commands = {
	"remote.turnOff": 1,
	"remote.number0": 2,
	"remote.number1": 3,
	"remote.number2": 4,
	"remote.number3": 5,
	"remote.number4": 6,
	"remote.number5": 7,
	"remote.number6": 8,
	"remote.number7": 9,
	"remote.number8": 10,
	"remote.number9": 11,
    "remote.up": 12,
    "remote.down": 13,
    "remote.left": 14,
    "remote.right": 15,
	"remote.ok": 20,
	"remote.home_menu": 21,
	"remote.back": 23,
	"remote.volumeUp": 24,
    "remote.volumeDown": 25,
    "remote.mute": 26,
    "remote.channelUp": 27,
    "remote.channelDown": 28,
	"remote.blue": 29,
	"remote.green": 30,
	"remote.red": 31,
	"remote.yellow": 32,
	"remote.play": 33,
	"remote.pause": 34,
	"remote.stop": 35,
	"fastForward": 36,
	"rewind": 37,
	"skipForward": 38,
	"skipBackward": 39,
	"record": 40,
	"recordingList": 41,
	"repeat": 42,
	"liveTv": 43,
	"epg": 44,
	"Prog_info": 45,
	"ratio": 46,
	"remote.input": 47,
	"PiP": 48,
	"subtitle": 49,
	"proglist": 50,
	"teletext": 51,
	"mark": 52,
	"3Dmode": 400,
	"3D_L/R": 401,
	"dash": 402,
	"prevchannel": 403,
	"favouriteChannel": 404,
	"quickMenu": 405,
	"textOption": 406,
	"audioDescription": 407,
	"netCast": 408,
	"energySaving": 409,
	"avMode": 410,
	"simplink": 411,
	"exit": 412,
	"reservationProglist": 413,
	"PiP_channelUp": 414,
	"PiP_channelDown": 415,
	"switchPriSecVideo": 416,
	"myApps": 417,
	"states.launch": "states",
	"MOUSE_MOVE": "HandleTouchMove",
	"MOUSE_CLICK": "HandleTouchClick",
	"TOUCH_WHEEL": "HandleTouchWheel",
	"CHANGE_CHANNEL": "HandleChannelChange",
	"CMD_SCROLL_UP": "up",
	"CMD_SCROLL_DOWN": "down",
	"INFO_CURRENT_CHANNEL": "cur_channel",
	"INFO_CHANNEL_LIST": "channel_list",
	"INFO_CONTEXT_UI": "context_ui",
	"INFO_VOLUME": "volume_info",
	"INFO_SCREEN":"screen_image",
	"INFO_3D": "is_3d",
	"INFO_APPS": "applist_get&type=1&index=1&number=1024",
	"remote.Netflix": "AppExecute",
	"TERMINATE_APP": "AppTerminate",
	"remote.changeChannel": "changeChannel"
}


function postRequest (device, path, post_data, callback) {
    var options = {
        host:  adapter.config.ip,
        port:   adapter.config.port,
        path:   path,
		method: 'POST',
		headers: {
          'Content-Type': 'application/atom+xml',
          'Content-Length': post_data.length
      }
    };
	var post_req = http.request(options, function(res) {
		var xmldata = '';
		res.setEncoding('utf8'),
		res.on('error', function (e) {
			logger.warn ("lgtv: " + e);
			if (callback) 
				callback (device, null);
		});
		res.on('data', function(chunk){
			xmldata += chunk;
		})
		res.on('end', function () {
			adapter.log.info('Response: ' + xmldata);
			if (callback) 
				callback (device, xmldata);
		});
	});

	// post the data
	post_req.write(post_data);
	post_req.end();
}







function connect()
{
	adapter.log.debug("connect() Start");
	connected = false;

	isOnline(function (data) {
		adapter.log.debug("isOnline data: " + data);
		if(data != false && adapter.config.pairingkey != '') 
		{
			connected = true;
			adapter.setStateChanged('connected', connected, true);	
			adapter.log.debug("isOnline: " + connected);
			// Start read state
			adapter.setState("states.launch", true);
		} else {
			adapter.setStateChanged('connected', false, true);	
		}
	});
}

function isOnline(callback)
{
	adapter.log.debug('isOnline gestartet');
	
	var message_request = '';

	var options = {
		hostname : adapter.config.ip,
		port :adapter.config.port,
		path : '/',
		method : 'GET'
	};
	
  	var req = http.request(options, function (res) 
	{
		adapter.log.debug('isOnline statusCode: ' + res.statusCode);
		callback(true);
	});

	req.on('error', error => {
		//adapter.log.error('isOnline error' + error)
		callback(false);
	});

	req.setTimeout(10000, function() {                                                                                                                              
		adapter.log.error("Server connection timeout (after 10 second)");                                                                                                                  
		req.abort();
	});
	
	req.end();
}

function RequestState(getCommand, callback)
{
	adapter.log.debug('Starting RequestState: ' + getCommand);

	var xmldata = '';	
	var options = {
		hostname : adapter.config.ip,
		port : adapter.config.port,
		path : '/roap/api/data?target=' + getCommand ,
		method : 'GET',
		headers: {
          'Content-Type': 'application/atom+xml',
          'Content-Length': xmldata.length
		}
	};

	var req = http.request(options, function (res) 
	{
		if(res.statusCode == 200) 
		{
			adapter.log.debug('SUCCESS: RequestState')
			res.setEncoding('utf8'),
			res.on('data', function(chunk){
				xmldata += chunk;
			})
			res.on('data', function(xmldata)
			{
				adapter.log.debug('RequestState: ' + xmldata);
				callback(xmldata);
			});
		}
		else 
		{
			adapter.log.error('Error on RequestState ' + res.statusCode + ' (statusCode)');
			callback(false);
		}
	});

	req.on('error', error => {
		adapter.log.error('Error: on RequestState ' + error)
		callback(false);
	});

	req.setTimeout(10000, function() {                                                                                                                              
		adapter.log.error("Server connection timeout (after 10 second)");                                                                                                                  
		req.abort();
	});
	
	req.end();
}

function RequestPairingKey(ip, port) 
{
	adapter.log.info('Requesting Pairing Key on TV: ' + adapter.config.ip + '...');

	var message_request = '<?xml version="1.0" encoding="utf-8"?>' +
		'<auth><type>AuthKeyReq</type></auth>';

	var options = {
		hostname : ip,
		port : port,
		path : '/roap/api/auth',
		method : 'POST'
	};

	var req = http.request(options, function (res) 
	{
		if(res.statusCode == 200) 
			adapter.log.debug('The Pairing Key is being displayed on the TV screen.')
		else 
			adapter.log.error('HTTP Request Error: ' + res.statusCode + ' (statusCode)');
	});
	
	req.on('error', function (error) 
	{
		adapter.log.error('Request Error: ' + error);
	});
	
	req.setHeader('Content-Type', 'text/xml; charset=utf-8');
	req.end(message_request);
}

function RequestSessionKey(pairingKey, callback) 
{
	adapter.log.debug('Starting RequestSessionKey on TV: ' + adapter.config.ip + ' with pairing key ' + pairingKey);

	var message_request = '<?xml version="1.0" encoding="utf-8"?>' +
		'<auth><type>AuthReq</type><value>' +
		pairingKey + '</value></auth>';
		
	var options = {
		hostname : adapter.config.ip,
		port : adapter.config.port,
		path : '/roap/api/auth',
		method : 'POST'
	};

	var req = http.request(options, function (res) 
	{
		if(res.statusCode == 200) 
		{
			adapter.log.debug('SUCCESS: The Pairing request on LG TV has succeeded.')
			res.on('data', function(data)
			{
				adapter.log.debug('RequestSessionKey HTTP Response: ' + data);
				callback(data);
			});
		}
		else 
		{
			adapter.log.error('Error on RequestSessionKey ' + res.statusCode + ' (statusCode)');
			callback(false);
		}
	});

	req.on('error', error => {
		adapter.log.error('Error: on RequestSessionKey ' + error)
		callback(false);
	});

	req.setTimeout(10000, function() {                                                                                                                              
		adapter.log.error("Server connection timeout (after 10 second)");                                                                                                                  
		req.abort();
	});


	req.setHeader('Content-Type', 'text/xml; charset=utf-8');
	req.end(message_request);
}

function RequestCommand(sessionID, commandKey) 
{
	adapter.log.debug('RequestCommand: ' + commandKey);
	var message_request = '<?xml version="1.0" encoding="utf-8"?><command><session>' + sessionID + "</session>" + commandKey

	var options = {
		hostname : adapter.config.ip,
		port : adapter.config.port,
		path : '/roap/api/command',
		method : 'POST'
	};

	var req = http.request(options, function (res) 
	{
		if(res.statusCode != 200) 
		{
			adapter.log.error('Error HTTP Request RequestCommand "' + commandKey + '": ' + res.statusCode + ' (statusCode)');
		}
	});
	
	req.on('error', function (error) 
	{
		adapter.log.error('Error RequestCommand: ' + error);
	});
	
	req.setHeader('Content-Type', 'text/xml; charset=utf-8');
	req.end(message_request);
}

function startAdapter(options) {
    options = options || {};
    Object.assign(options,{
        name:  "lgtv2012",
        stateChange:  function (id, state) {
            if (id && state && !state.ack)
			{
				id = id.substring(adapter.namespace.length + 1);
				if(typeof commands[id] != "undefined")
				{
					adapter.log.debug('Starting state change "' + id + '", value: "' + state.val + '" ip: ' + adapter.config.ip + ' port: ' + adapter.config.port);
					RequestSessionKey(adapter.config.pairingkey, function (data) 
					{
						if(data)
						{
							adapter.log.debug('RequestCommand, Data response after RequestSessionKey: ' + data + ' Command:' +commands[id]);
							switch (commands[id]) {
								case 'states':
									clearInterval(pollTimer);
									var parser = new DOMParser();
									var xmlDoc
									RequestState('volume_info', function (xmldata)
									{
										if(xmldata)
										{
											adapter.log.debug('RequestState volume_info: ' + xmldata);
											xmlDoc = parser.parseFromString(xmldata,"text/xml");
											volume = xmlDoc.getElementsByTagName("level")[0].childNodes[0].nodeValue
											adapter.setStateChanged('states.volume', volume, true);
											adapter.setStateChanged('states.mute', xmlDoc.getElementsByTagName("mute")[0].childNodes[0].nodeValue, true);
										}
									});
										
									RequestState('cur_channel', function (xmldata)
									{
										if(xmldata)
										{
											adapter.log.debug('RequestState cur_channel: ' + xmldata);
											xmlDoc = parser.parseFromString(xmldata,"text/xml");
											var inputSource = xmlDoc.getElementsByTagName("inputSourceName")[0].childNodes[0].nodeValue
											adapter.setStateChanged('states.inputSource', inputSource, true);
											if(inputSource == 'Kabel') {
												adapter.setStateChanged('states.channel', xmlDoc.getElementsByTagName("chname")[0].childNodes[0].nodeValue, true);
											}											
										}
									});
										
									RequestState('is_3d', function (xmldata)
									{
										if(xmldata)
										{
											adapter.log.debug('RequestState is_3d: ' + xmldata);
											xmlDoc = parser.parseFromString(xmldata,"text/xml");
											adapter.setStateChanged('states.3D', xmlDoc.getElementsByTagName("is3D")[0].childNodes[0].nodeValue, true);
										}
									});

									RequestState('applist_get&type=1&index=1&number=1024', function (xmldata)
									{
										if(xmldata)
										{
											adapter.log.debug('RequestState applist: ' + xmldata);
											xml2js.parseStringPromise(xmldata /*, options */).then(function (result) {
												adapter.setStateChanged('info.applist', JSON.stringify(result.envelope.data), true);
											});

										}
									});
									pollTimer = setInterval(connect, parseInt(adapter.config.interval, 10))
									break;

								case "24":
									if(volume<100) { 
										adapter.log.debug("volume up(24)");
										RequestCommand(data, "<type>HandleKeyInput</type><value>24</value></command>");
										volume = volume + 1
										adapter.setState('states.volume', volume, true);
									}
									break;
								case "25":
									if(volume>0) { 
										adapter.log.debug("volume down(25)");
										RequestCommand(data, "<type>HandleKeyInput</type><value>25</value></command>");
										volume = volume - 1
										adapter.setState('states.volume', volume, true);
									}
									break;
								case "changeChannel":
									/*
									 Beispiel VOX: "<name>HandleChannelChange</name><major>12</major><minor>0</minor><sourceIndex>3</sourceIndex><physicalNum>26</physicalNum></command>
									 Beispiel RTL: "<name>HandleChannelChange</name><major>4</major><minor>0</minor><sourceIndex>3</sourceIndex><physicalNum>1</physicalNum></command>"
									*/
									RequestCommand(data,"<name>HandleChannelChange</name><major>12</major><minor>0</minor><sourceIndex>3</sourceIndex><physicalNum>26</physicalNum></command>");
									break;
								case 'AppExecute':
									adapter.log.debug("AppExecute");
									if(loadedApp == '') {
										RequestCommand(data,"<name>AppExecute</name><auid>00000000000112ae</auid><appname>Netflix</appname></command>");
										loadedApp = "Netflix,00000000000112ae";
										adapter.setState('states.app', loadedApp, true);
									} else {
										RequestCommand(data,"<name>AppTerminate</name><auid>00000000000112ae</auid><appname>Netflix</appname></command>")
										loadedApp = "";
										adapter.setState('states.app', loadedApp, true);
									}
									break;
								default:
									adapter.log.debug("default: " + commands[id]);
									RequestCommand(data, "<type>HandleKeyInput</type><value>" + commands[id] + "</value></command>");
									break;
							}
							adapter.setState(id, !!state.val, true);
						} else adapter.log.info('RequestCommand, No Data response after RequestSessionKey!');
					});
				}
			}
        },
        unload: function (callback) {
			adapter.setState('states.app', '', true);
            callback();
        },
        ready: function () {
            main();
        }
    });

    adapter = new utils.Adapter(options);

    return adapter;
}

adapter.on('message', function (obj) 
{
	adapter.log.info('Incoming Adapter message: ' + obj.command);
    switch (obj.command) 
	{
        case 'RequestPairingKey_Msg':
            if (!obj.callback) return false;
			RequestPairingKey(adapter.config.ip, adapter.config.port);
		return true;
		
        default:
            adapter.log.warn("Unknown command: " + obj.command);
		break;
    }
});

function main() 
{
	adapter.log.info('Ready. Configured LG TV IP: ' + adapter.config.ip + ', Port: ' + adapter.config.port + ', Pairing Key: ' + adapter.config.pairingkey);
	
    adapter.subscribeStates('*');
	//connect();
	if (parseInt(adapter.config.interval, 10) && adapter.config.pairingkey != '') 
	{
		pollTimer = setInterval(connect, parseInt(adapter.config.interval, 10));
	}
}



