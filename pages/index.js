(function ($) {
    $.widget("pic.dashboard", {
        options: { socket: null },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initState();
            el[0].receiveLogMessages = function (val) { self.receiveLogMessages(val); };
            el[0].reset = function () { self._reset(); };
        },
        _clearPanels: function () {
            var self = this, o = self.options, el = self.element;
        },
        _initState: function () {
            var self = this, o = self.options, el = self.element;
            console.log('initializing state');
            self._initSockets();
        },
        _initSockets: function () {
            var self = this, o = self.options, el = self.element;
            o.socket = io(o.apiServiceUrl, { reconnectionDelay: 2000, reconnection: true, reconnectionDelayMax: 20000 });
            o.socket.on('valves', function (data) {
                //console.log({ evt: 'valves', data: data });
                for (var i = 0; i < data.valves.length; i++) {
                    var valve = data.valves[i];
                    var valves = $('div.valve[data-eqid=' + valve.id + ']');
                    if (valves.length === 0) {
                        $('<div></div>').appendTo(el.find('div.valves')).attr('data-eqid', valve.id).valve();
                        valves = $('div.valve[data-eqid=' + valve.id + ']');
                    }
                    valves.each(function() { this.databind(valve); });
                }
            });
            o.socket.on('connect_error', function (data) {
                console.log('connection error:' + data);
                o.isConnected = false;
            });
            o.socket.on('connect_timeout', function (data) {
                console.log('connection timeout:' + data);
            });

            o.socket.on('reconnect', function (data) {
                console.log('reconnect:' + data);
            });
            o.socket.on('reconnect_attempt', function (data) {
                console.log('reconnect attempt:' + data);
            });
            o.socket.on('reconnecting', function (data) {
                console.log('reconnecting:' + data);
            });
            o.socket.on('reconnect_failed', function (data) {
                console.log('reconnect failed:' + data);
            });
            o.socket.on('connect', function (sock) {
                console.log({ msg: 'socket connected:', sock: sock });
                o.isConnected = true;
            });
            o.socket.on('close', function (sock) {
                console.log({ msg: 'socket closed:', sock: sock });
                o.isConnected = false;
            });
            o.socket.on('*', function (event, data) {
                console.log({ evt: event, data: data });
            });
        }
    });
    $.widget("pic.valve", {
        options: { socket: null },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el[0].databind = function (data) { self.databind(data); };
            self.buildControls();
        },
        buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.empty();
            if (!el.hasClass('valve')) el.addClass('valve');
            var pnl = $('<div></div>').appendTo(el).addClass('valvePanel');

            var line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Valve Key')
            $('<span></span>').appendTo(line).attr('data-bind', 'key');
            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Address');
            $('<span></span>').appendTo(line).attr('data-bind', 'address').attr('data-fmttype', 'int').attr('data-fmtmask', '#');


            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Method')
            $('<span></span>').appendTo(line).attr('data-bind', 'method');

            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Groots');
            $('<span></span>').appendTo(line).attr('data-bind', 'totalGroots').attr('data-fmttype', 'int').attr('data-fmtmask', '#,##0');
            line = $('<div></div>').appendTo(pnl);

            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Statuses');
            $('<span></span>').appendTo(line).attr('data-bind', 'totalStatus').attr('data-fmttype', 'int').attr('data-fmtmask', '#,##0');
            line = $('<div></div>').appendTo(pnl);


            $('<label></label>').appendTo(line).text('Commands');
            //$('<span></span>').appendTo(line).attr('data-bind', 'totalMessages').attr('data-fmttype', 'int').attr('data-fmtmask', '#,##0');
            $('<span></span>').appendTo(line).attr('data-bind', 'totalCommands').attr('data-fmttype', 'int').attr('data-fmtmask', '#,##0');

            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Last Groot');
            $('<span></span>').appendTo(line).attr('data-bind', 'tsLastGroot').attr('data-fmttype', 'datetime').attr('data-fmtmask', 'MM/dd h:mmtt ss.nn');
            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Groot Message');
            $('<span></span>').appendTo(line).attr('data-bind', 'grootMessage');

            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Last Status');
            $('<span></span>').appendTo(line).attr('data-bind', 'tsLastStatus').attr('data-fmttype', 'datetime').attr('data-fmtmask', 'MM/dd h:mmtt ss.nn');
            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Status Message');
            $('<span></span>').appendTo(line).attr('data-bind', 'statusMessage');



            //line = $('<div></div>').appendTo(pnl);
            //$('<label></label>').appendTo(line).text('Last Message');
            //$('<span></span>').appendTo(line).attr('data-bind', 'lastMessage');

            line = $('<div></div>').appendTo(pnl);
            $('<label></label>').appendTo(line).text('Last Command');
            $('<span></span>').appendTo(line).attr('data-bind', 'commandMessage');

            //line = $('<div></div>').appendTo(pnl);
            //$('<label></label>').appendTo(line).text('Last Verified');
            //$('<span></span>').appendTo(line).attr('data-bind', 'lastVerified');

            line = $('<div></div>').appendTo(el).addClass('respOuter');
            var grp = $('<fieldset></fieldset>').appendTo(line);
            $('<legend></legend>').appendTo(grp).text('Responses');
            line = $('<div></div>').appendTo(grp).addClass('responses');

            line = $('<div></div>').appendTo(el).addClass('respStatOuter');
            grp = $('<fieldset></fieldset>').appendTo(line);
            $('<legend></legend>').appendTo(grp).text('Status');
            line = $('<div></div>').appendTo(grp).addClass('statuses');
        },
        databind: function (data) {
            var self = this, o = self.options, el = self.element;
            dataBinder.bind(el.find('div.valvePanel'), data);
            var resp = el.find('div.responses');
            var stat = el.find('div.statuses');
            if (typeof data.responses === 'undefined' || data.responses.length === 0) resp.empty();
            else {
                for (var i = 0; i < data.responses.length; i++) {
                    var r = resp.find('div.response[data-index=' + i + ']');
                    if (r.length === 0) {
                        // Add in our response object since it doesn't exist.
                        r = $('<div></div>').appendTo(resp).addClass('response').attr('data-index', i);
                        var line = $('<div></div>').appendTo(r);
                        $('<label></label>').appendTo(line).text('ts');
                        $('<span></span>').appendTo(line).attr('data-bind', 'ts').attr('data-fmttype', 'datetime').attr('data-fmtmask', 'MM/dd h:mmtt ss.nn');

                        line = $('<div></div>').appendTo(r);
                        $('<label></label>').appendTo(line).text('in');
                        $('<span></span>').appendTo(line).attr('data-bind', 'in');

                        line = $('<div></div>').appendTo(r);
                        $('<label></label>').appendTo(line).text('out');
                        $('<span></span>').appendTo(line).attr('data-bind', 'out');
                        dataBinder.bind(r, data.responses[i]);
                    }
                    else
                        dataBinder.bind(r, data.responses[i]);
                }
                // Trim off all the ones that are greater than the number of responses.
                var rs = resp.find('div.response');
                if (rs.length > data.responses.length) {
                    for (var k = rs.length; k > data.responses.length; k--) {
                        $(rs[k]).remove();
                    }
                }
            }
            if (typeof data.statusChanges === 'undefined' || data.statusChanges.length === 0) stat.empty();
            else {
                for (var i = 0; i < data.statusChanges.length; i++) {
                    var s = stat.find('div.statusChanges[data-index=' + i + ']');
                    if (s.length === 0) {
                        // Add in our response object since it doesn't exist.
                        s = $('<div></div>').appendTo(stat).addClass('status').attr('data-index', i);
                        var line = $('<div></div>').appendTo(r);
                        $('<label></label>').appendTo(line).text('ts');
                        $('<span></span>').appendTo(line).attr('data-bind', 'ts').attr('data-fmttype', 'datetime').attr('data-fmtmask', 'MM/dd h:mmtt ss.nn');

                        line = $('<div></div>').appendTo(r);
                        $('<label></label>').appendTo(line).text('Prev');
                        $('<span></span>').appendTo(line).attr('data-bind', 'prev');

                        line = $('<div></div>').appendTo(r);
                        $('<label></label>').appendTo(line).text('New');
                        $('<span></span>').appendTo(line).attr('data-bind', 'curr');
                        dataBinder.bind(r, data.statusChanges[i]);
                    }
                    else
                        dataBinder.bind(r, data.statusChanges[i]);
                }
                // Trim off all the ones that are greater than the number of responses.
                var rs = stat.find('div.status');
                if (rs.length > data.statusChanges.length) {
                    for (var k = rs.length; k > data.statusChanges.length; k--) {
                        $(rs[k]).remove();
                    }
                }
            }

        }
    });

})(jQuery);