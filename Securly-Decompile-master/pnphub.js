function checkPnPHub() {
    getIPs(function(e) {
        checkIP(e)
    })
}

function executePnPCmd(e, t) {
    var n = "http://admin.pnphub.com/cgi-bin/luci/rpc/sys?auth=" + e.result;
    params = {
        jsonrpc: e.jsonrpc,
        id: e.id + 1,
        method: "exec",
        params: ["/usr/share/scripts/bypChrbk.sh " + t + " &"]
    };
    var s = new XMLHttpRequest;
    s.open("POST", n, !0), s.setRequestHeader("Content-Type", "application/json"), s.onreadystatechange = function() {
        4 == s.readyState && (200 == s.status ? "FAIL" == JSON.parse(s.responseText).result && authToken(e, t) : console.log("PnPHub error", s.status))
    }, s.send(JSON.stringify(params))
}

function authToken(e, t) {
    var n = checkClusterURL + "/crextn/authtoken?type=generate";
    chrome.identity.getProfileUserInfo(function(s) {
        params = {
            email: s.email
        };
        var r = new XMLHttpRequest;
        r.open("POST", n, !0), r.setRequestHeader("Content-Type", "application/json"), r.onreadystatechange = function() {
            if (4 == r.readyState)
                if (200 == r.status) {
                    var n = JSON.parse(r.responseText);
                    "true" == n.result && registerIp(e, t, n.token)
                } else console.log("PnPHub error", r.status)
        }, r.send(JSON.stringify(params))
    })
}

function registerIp(e, t, n) {
    var s = "http://admin.pnphub.com/cgi-bin/luci/rpc/sys?auth=" + e.result;
    params = {
        jsonrpc: e.jsonrpc,
        id: e.id + 1,
        method: "exec",
        params: ["/usr/share/scripts/bypChrbk.sh " + t + " " + n + " &"]
    };
    var r = new XMLHttpRequest;
    r.open("POST", s, !0), r.setRequestHeader("Content-Type", "application/json"), r.onreadystatechange = function() {
        if (4 == r.readyState)
            if (200 == r.status) {
                if ("FAIL" == JSON.parse(r.responseText).result) return;
                destroyToken(n)
            } else console.log("PnPHub error", r.status)
    }, r.send(JSON.stringify(params))
}

function destroyToken(e) {
    var t = checkClusterURL + "/crextn/authtoken?type=destroy&tok=" + e;
    chrome.identity.getProfileUserInfo(function(e) {
        var n = new XMLHttpRequest;
        n.open("GET", t, !0), n.setRequestHeader("Content-Type", "application/json"), n.onreadystatechange = function() {
            if (4 == n.readyState)
                if (200 == n.status) {
                    if ("true" == JSON.parse(n.responseText).result) return
                } else console.log("PnPHub error", n.status)
        }, n.send(JSON.stringify(params))
    })
}

function checkIP(e) {
    var t = {
            jsonrpc: "2.0",
            method: "login",
            params: ["luci", "S3cur!y321"],
            id: 1,
            ip: e
        },
        n = new XMLHttpRequest;
    n.open("POST", "http://admin.pnphub.com/cgi-bin/luci/rpc/auth", !0), n.setRequestHeader("Content-Type", "application/json"), n.onreadystatechange = function() {
        if (4 == n.readyState)
            if (200 == n.status) {
                var t = JSON.parse(n.responseText);
                null != t.result && executePnPCmd(t, e)
            } else console.log("PnPHub error", n.status)
    }, n.send(JSON.stringify(t))
}

function getIPs(e) {
    function t(t) {
        var s = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(t)[1];
        void 0 === n[s] && e(s), n[s] = !0
    }
    var n = {},
        s = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    window.webkitRTCPeerConnection;
    if (!s) {
        var r = iframe.contentWindow;
        s = r.RTCPeerConnection || r.mozRTCPeerConnection || r.webkitRTCPeerConnection, !!r.webkitRTCPeerConnection
    }
    var o = new s({
        iceServers: [{
            urls: "stun:stun.services.mozilla.com"
        }]
    }, {
        optional: [{
            RtpDataChannels: !0
        }]
    });
    o.onicecandidate = function(e) {
        e.candidate && t(e.candidate.candidate)
    }, o.createDataChannel(""), o.createOffer(function(e) {
        o.setLocalDescription(e, function() {}, function() {})
    }, function() {}), setTimeout(function() {
        o.localDescription.sdp.split("\n").forEach(function(e) {
            0 === e.indexOf("a=candidate:") && t(e)
        })
    }, 1e3)
}
