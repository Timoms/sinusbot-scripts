registerPlugin({
    name: 'Ticker',
    version: '3.0.0.2',
    description: 'channel based running text with news support. User ".tickeron" or ".tickeroff" to toggle the ticker."',
    author: 'Created by Timo Heckel <timo.heckel@ompan.net> | Reworked by Lukas Westholt <lukaswestholt@yahoo.de>',
	autorun: false,
    engine: ">= 1.0.0",
    backends: ["ts3"],
    requiredModules: ['http'],
    vars: [{
        name: 'type',
        title: 'Channel/Bot Type',
        type: 'select',
        indent: 0,
        options: [
            'Spacer',
            'Normal',
            'AwayMessage'
        ]
    },
    {
        name: 'channel1',
        title: 'Select a channel for the ticker',
        type: 'channel',
        indent: 0,
        conditions: [
            { field: 'type', value: 0}
        ]
    },
    {
        name: 'channel2',
        title: 'Select a channel for the ticker',
        type: 'channel',
        indent: 0,
        conditions: [
            { field: 'type', value: 1}
        ]
    },
    {
        name: 'txttype',
        title: 'Which input would you like to have?',
        type: 'select',
        indent: 0,
        options: [
            'Use your own text',
            'Use your own index.html/index.php/name.txt with blank text.'
        ]
    },
    {
        name: 'txt',
        title: 'Text to be displayed',
        type: 'multiline',
        indent: 2,
        conditions: [
            { field: 'txttype', value: 0}
        ]
    },
    {
        name: 'yourapi',
        title: 'Your (with text filled) website [best is a blank yourname.txt file] ',
        type: 'string',
        placeholder: 'for example: https://api.ompan.net/txt.txt',
        indent: 2,
        conditions: [
            { field: 'txttype', value: 1}
        ]
    },
    {
        name: 'interval',
        title: 'Time between each letter in tenth seconds',
        type: 'number',
        indent: 0
    }]
    /**
     * @param {{type:string, channel1:string, channel2:string, txttype:string, txt:string, yourapi:string, interval:number}} config
     */
}, function(_, config) {
	
    const engine = require('engine');
    const backend = require('backend');
    const event = require('event');
    const store = require('store');
    const http = require('http');
	
	engine.log("[INFO] Loaded Sinusbot Ticker Script 3.0.0.1 by Timo Heckel <timo.heckel@ompan.net>");
    let start = 0;
    let msg_g = "[loading...]";
    let prefix = "";
    let initialized = false;
    let interval_pid;

    event.on("load", () => {
        if (backend.isConnected()) return initialize();
        event.on("connect", initialize);
        event.on("disconnect", finish);
    });

    event.on('chat', function (ev) {
        if (ev.text === ".tickeron") {
            store.setInstance("enabled", true);
            ev.client.chat("Ticker enabled.");
        } else if (ev.text === ".tickeroff") {
            store.setInstance("enabled", false);
            ev.client.chat("Ticker disabled.");
        }
    });

    function finish() {
        if (interval_pid) clearInterval(interval_pid);
        interval_pid = false;
        initialized = false;
    }

    function setDefaultInterval() {
        config.interval = 1;
        engine.saveConfig(config);
        return 100;
    }
    function initialize() {
        if (initialized) return;
        initialized = true;
        let interval = config.interval ? config.interval * 100 : setDefaultInterval();

        if (typeof store.getInstance("enabled") === "undefined") {
            store.setInstance("enabled", true);
        } else if (!store.getInstance("enabled")) {
            engine.log("[INFO] Lauftext / Ticker is stopped. For activating send \".tickeron\" to the sinusbot on your TS");
        }
        let channel;
        let away;
        if (config.type === "0" || config.type === "1") {
            channel = config.channel1 || config.channel2 || false;
        } else if (config.type === "2") {
            away = true;
        } else {
            engine.log("[CRITICAL] please fill in \"type\"");
            return;
        }

        if (!(channel || away)) {
            engine.log("[CRITICAL] please fill in \"type\" and \"channel\"");
            return;
        }

        if (config.txttype === "0" && config.txt) {
            let txt = config.txt;

            interval_pid = setInterval(function () {
                if (store.getInstance("enabled")) {
                    let math_min;
                    if (config.type === "0") {
                        prefix = "[cspacer]";
                        math_min = Math.min(40 - prefix.length, txt.length);
                    } else if (config.type === "1") {
                        math_min = Math.min(40, txt.length);
                    } else if (away) {
                        math_min = Math.min(20, txt.length);
                        txt = config.txt + " ";
                    } else {
                        engine.log("[CRITICAL] there was an error");
                        return;
                    }
                    let channelName = "";
                    for (let i = start; channelName.length < math_min; i++) {
                        if (i >= txt.length) {
                            i -= txt.length;
                        }
                        channelName = channelName + txt.charAt(i);
                    }
                    if (typeof channel !== "undefined" && channel && typeof backend.getChannelByID(channel) !== "undefined") {
                        backend.getChannelByID(channel).setName(prefix + channelName);
                    } else if (away) {
                        setAway(true, channelName);
                    }
                    start++;
                    if (start >= txt.length) {
                        start = 0;
                    }
                } else if (away) {
                    setAway(false);
                }
            }, interval);
        } else if (config.txttype === "1" && config.yourapi) {
            let yourapi = config.yourapi;

            interval_pid = setInterval(function () {
                let http_config = {
                    "method": "GET",
                    "url": yourapi,
                    "timeout": 60000,
                    "headers": [{
                        "Content-Type": "text/plain; charset=UTF-8"
                    }]
                };

                function Process(error, response) {
                    if (response.statusCode !== 200) {
                        engine.log("Sorry, Your API/Website is currently not available. Please try again later or contact timo.heckel@ompan.net for help.");
                    } else {
                        msg_g = response.data.toString(); //weil das Bytes sind 18.01.2019
                        //engine.log(response.data);
                    }
                }

                http.simpleRequest(http_config, Process);
                //Fertige daten, msg_g ist die Variable

                if (store.getInstance("enabled")) {
                    if (config.type === "0") {
                        prefix = "[cspacer]";
                    }
                    let channelName = "";
                    for (let i = start; channelName.length < Math.min(40 - prefix.length, msg_g.length); i++) {
                        if (i >= msg_g.length) {
                            i -= msg_g.length;
                        }
                        channelName = channelName + msg_g.charAt(i);
                    }
                    if (typeof channel !== "undefined" && channel && typeof backend.getChannelByID(channel) !== "undefined") {
                        backend.getChannelByID(channel).setName(prefix + channelName);
                    } else if (away) {
                        setAway(true, channelName);
                    }
                    start++;

                    if (start >= msg_g.length) {
                        start = 0;
                    }
                } else if (away) {
                    setAway(false);
                }
            }, interval);

        } else {
            engine.log("[CRITICAL] please fill in all settings");
        }
    }
});