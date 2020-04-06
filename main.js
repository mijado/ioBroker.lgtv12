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
var parser = new DOMParser();
const xml2js = require('xml2js');

let hostUrl, lgtvobj
var pollTimer = null;
var volume; 
var index;
var AppOldIndex = null;
var ChannelRequest = true;
var AppsRequest = true;
var Apps = []
var auid = []
var Channels = ['']
var physicalNum = ['']

if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 

let connected = false;

var commands = {
	"remote.turnOff": 1,
	"remote.#0": 2,
	"remote.#1": 3,
	"remote.#2": 4,
	"remote.#3": 5,
	"remote.#4": 6,
	"remote.#5": 7,
	"remote.#6": 8,
	"remote.#7": 9,
	"remote.#8": 10,
	"remote.#9": 11,
    "remote.arrow_up": 12,
    "remote.arrow_down": 13,
    "remote.arrow_left": 14,
    "remote.arrow_right": 15,
	"remote.ok": 20,
	"remote.home_menu": 21,
	"remote.back": 23,
	"remote.volumeUp": 24,
    "remote.volumeDown": 25,
    "remote.mute": 26,
    "remote.channelUp": 27,
    "remote.channelDown": 28,
	"remote.color_blue": 29,
	"remote.color_green": 30,
	"remote.color_red": 31,
	"remote.color_yellow": 32,
	"remote.player_play": 33,
	"remote.player_pause": 34,
	"remote.player_stop": 35,
	"remote.player_fastForward": 36,
	"remote.player_rewind": 37,
	"remote.player_skipForward": 38,
	"remote.player_skipBackward": 39,
	"remote.record": 40,
	"remote.recordingList": 41,
	"remote.repeat": 42,
	"remote.liveTv": 43,
	"remote.epg": 44,
	"remote.prog_info": 45,
	"remote.ratio": 46,
	"remote.input": 47,
	"remote.pip": 48,
	"subtitle": 49,
	"remote.proglist": 50,
	"teletext": 51,
	"mark": 52,
	"remote.3Dmode": 400,
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
	"remote.exit": 412,
	"reservationProglist": 413,
	"PiP_channelUp": 414,
	"PiP_channelDown": 415,
	"switchPriSecVideo": 416,
	"remote.myApps": 417,
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
	"remote.Netflix": "Netflix",
	"TERMINATE_APP": "AppTerminate"
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
		adapter.setStateChanged('connected', false, true);			
		req.abort();
	});
	
	req.end();
}

function getAppList()
{
	adapter.log.info('Starting GetAppList');
	adapter.setState('info.applist', '', true);	
	var xmldata = '';
	var options = {
		host:  adapter.config.ip,
		port:   adapter.config.port,
		path : '/roap/api/data?target=applist_get&type=1&index=1&number=0',
		method: 'GET',
		headers: {
			'Content-Type': 'application/atom+xml',
			'Content-Length': xmldata.length
			}
	};
										
	var req = http.request(options, function(res) {
		res.setEncoding('utf8'),
			res.on('data',function(chunk){
				xmldata+= chunk;
			});

			res.on('end',function(){
				adapter.log.debug('getAppList xmldata ' + xmldata.length + ' : ' + xmldata);
				parser = new DOMParser();
				var xmlDoc = parser.parseFromString(xmldata,"text/xml");
				var x = xmlDoc.getElementsByTagName("icon_name");
				var id = xmlDoc.getElementsByTagName("auid");
				var n = xmlDoc.getElementsByTagName("name");
				Apps.push('TV');
				auid.push('000');
				for (var i = 0; i < x.length; i++) {
					if(x[i].childNodes[0].nodeValue.search('addon') < 0) {
						Apps.push(n[i].childNodes[0].nodeValue);
						auid.push(id[i].childNodes[0].nodeValue);
						adapter.log.debug('AppName: '+ Apps[i] + ' auid:' + auid[i]);
					}
				}
				adapter.setObjectNotExists('states.applist', {
				type: 'state',
				common: {
					name: 'App List',
					type: 'string',
					role: 'state',
					states: Apps,
					read: false,
					write: true
				},
					native: {}
				});
				adapter.setState('states.applist', {val: Apps, ack: true});
				adapter.setState('states.applist', {val: Apps[0], ack: true});
				Apps.forEach(function(item, index, array) {
					adapter.log.info(item +","+ index);
				});
				AppsRequest = false;
			});
	});
	req.end();
}	

function getChannelList()
{
	adapter.log.info('Starting GetChannelList');
	var xmldata = '';
	var options = {
		host:  adapter.config.ip,
		port:   adapter.config.port,
		path : '/roap/api/data?target=channel_list',
		method: 'GET',
		headers: {
			'Content-Type': 'application/atom+xml',
			'Content-Length': xmldata.length
			}
	};
										
	var req = http.request(options, function(res) {
		res.setEncoding('utf8'),
			res.on('data',function(chunk){
				xmldata+= chunk;
			});

			res.on('end',function(){
				adapter.log.debug('getChannelList xmldata ' + xmldata.length + ' : ' + xmldata);
				parser = new DOMParser();
				var xmlDoc = parser.parseFromString(xmldata,"text/xml");
				var x = xmlDoc.getElementsByTagName("chname");
				var y = xmlDoc.getElementsByTagName("physicalNum");
				for (var i = 0; i < 50; i++) {
					adapter.log.debug(x[i].childNodes[0].nodeValue);
					Channels.push(x[i].childNodes[0].nodeValue);
					physicalNum.push(y[i].childNodes[0].nodeValue);
				}
				adapter.setObjectNotExists('states.channellist', {
				type: 'state',
				common: {
					name: 'Channel List',
					type: 'string',
					role: 'state',
					states: Channels,
					read: false,
					write: true
				},
					native: {}
				});
				adapter.setState('states.channellist', {val: Channels, ack: true});
				ChannelRequest = false;
			});
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
				adapter.log.debug('RequestState: ' + getCommand + ':' + xmldata);
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
        name:  "lgtv12",
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
											var chtype = xmlDoc.getElementsByTagName("chtype")[0].childNodes[0].nodeValue
											adapter.setStateChanged('states.inputSource', chtype, true);
											switch (chtype) {
												case 'cable':
													var Sender = xmlDoc.getElementsByTagName("chname")[0].childNodes[0].nodeValue
													//adapter.setStateChanged('states.channel', Sender , true);
													for (index = 0; index < Channels.length; ++index) {
														if(Channels[index] == Sender) {
															adapter.setState('states.channellist', {val: Channels[index], ack: true});
														}
													}
													break;
												case 'terrestrial':
													adapter.setStateChanged('states.channellist', Channels[0], true);
													break;
												default:
													break;
											}										}
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

									if(ChannelRequest) { 
										getChannelList()
									}
									if(AppsRequest) {
										getAppList()
									}
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
										volume = volume - 2
										adapter.setState('states.volume', volume, true);
									}
									break;
								case 'Netflix':
									adapter.getState('states.applist', function (err, state) {
										if(state.val != 'Netflix') {
											adapter.log.debug("Starte Netflix");
											for (index = 0; index < Apps.length; ++index) {
												if(Apps[index] == 'Netflix') {
													adapter.setState('states.applist', {val: Apps[index], ack: true});
													RequestCommand(data,"<name>AppExecute</name><auid>" + auid[index] + "</auid><appname>" + Apps[index] + "</appname></command>");
													/*
													setTimeout(function() {
														RequestCommand(data, "<type>HandleKeyInput</type><value>20</value></command>");
													}, 60000);
													*/
												}
											}
										} else {
											adapter.log.debug("Beende Netflix");
											adapter.setState('states.applist', {val: Apps[0], ack: true});
											RequestCommand(data,"<name>AppTerminate</name><auid>" + auid[state.val] + "</auid><appname>" + Apps[state.val] + "</appname></command>")
										}						
									});
									break;
								default:
									adapter.log.info("default: " + commands[id]);
									RequestCommand(data, "<type>HandleKeyInput</type><value>" + commands[id] + "</value></command>");
									break;
							}
							adapter.setState(id, !!state.val, true);
						} else adapter.log.info('RequestCommand, No Data response after RequestSessionKey!');
					});
				} else {
					switch (id) {
						case "states.applist":
				Apps.forEach(function(item, index, array) {
					adapter.log.info(item +","+ index);
				});

							adapter.log.info('states.applist: ' + state.val);
							index = state.val;
							RequestSessionKey(adapter.config.pairingkey, function (data) 
							{
								if(data) {
									if(index != 0) {
										
										adapter.log.info('Starte App ' + Apps[index] + ' ' + auid[index]);
										RequestCommand(data,"<name>AppExecute</name><auid>" + auid[index] + "</auid><appname>" + Apps[index] + "</appname></command>");
										AppOldIndex = index;
									} else {
										adapter.log.info('Stoppe App ' + Apps[AppOldIndex] + ' ' + auid[AppOldIndex]);
										adapter.setState('states.applist', {val: Apps[0], ack: true});
										RequestCommand(data,"<name>AppTerminate</name><auid>" + auid[AppOldIndex] + "</auid><appname>" + Apps[AppOldIndex] + "</appname></command>");
										AppOldIndex = null;
									}
								}
							});
							break;
						case "states.channellist":
							/*
							 Beispiel VOX: "<name>HandleChannelChange</name><major>12</major><minor>0</minor><sourceIndex>3</sourceIndex><physicalNum>26</physicalNum></command>
							 Beispiel RTL: "<name>HandleChannelChange</name><major>4</major><minor>0</minor><sourceIndex>3</sourceIndex><physicalNum>1</physicalNum></command>"
							*/
							adapter.log.debug('states.channellist: ' + Channels[id]);
							var major = state.val;
							RequestSessionKey(adapter.config.pairingkey, function (data) 
							{
								if(data) { 
									adapter.log.debug('Starte Kanal ' + Channels[major]);
									RequestCommand(data,"<name>HandleChannelChange</name><major>" + major + "</major><minor>0</minor><sourceIndex>3</sourceIndex><physicalNum>" + physicalNum[major]+ "</physicalNum></command>");
								}
							});
							break;
						default:
							adapter.log.info("unknown command: " + id);
							break;
					}	
				}
				
			}
        },
        unload: function (callback) {
			adapter.setState('states.app', Apps[0], true);
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



