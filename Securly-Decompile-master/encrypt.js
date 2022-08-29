function ENCRYPT(r) {
    function o(r, o) {
        return r << o | r >>> 32 - o
    }

    function e(r) {
        var o, e = "";
        for (o = 7; o >= 0; o--) e += (r >>> 4 * o & 15).toString(16);
        return e
    }
    var t, a, h, n, C, c, f, d, u, A = new Array(80),
        g = 1732584193,
        i = 4023233417,
        s = 2562383102,
        S = 271733878,
        m = 3285377520,
        p = (r = function(r) {
            r = r.replace(/\r\n/g, "\n");
            for (var o = "", e = 0; e < r.length; e++) {
                var t = r.charCodeAt(e);
                t < 128 ? o += String.fromCharCode(t) : t > 127 && t < 2048 ? (o += String.fromCharCode(t >> 6 | 192), o += String.fromCharCode(63 & t | 128)) : (o += String.fromCharCode(t >> 12 | 224), o += String.fromCharCode(t >> 6 & 63 | 128), o += String.fromCharCode(63 & t | 128))
            }
            return o
        }(r)).length,
        l = new Array;
    for (a = 0; a < p - 3; a += 4) h = r.charCodeAt(a) << 24 | r.charCodeAt(a + 1) << 16 | r.charCodeAt(a + 2) << 8 | r.charCodeAt(a + 3), l.push(h);
    switch (p % 4) {
        case 0:
            a = 2147483648;
            break;
        case 1:
            a = r.charCodeAt(p - 1) << 24 | 8388608;
            break;
        case 2:
            a = r.charCodeAt(p - 2) << 24 | r.charCodeAt(p - 1) << 16 | 32768;
            break;
        case 3:
            a = r.charCodeAt(p - 3) << 24 | r.charCodeAt(p - 2) << 16 | r.charCodeAt(p - 1) << 8 | 128
    }
    for (l.push(a); l.length % 16 != 14;) l.push(0);
    for (l.push(p >>> 29), l.push(p << 3 & 4294967295), t = 0; t < l.length; t += 16) {
        for (a = 0; a < 16; a++) A[a] = l[t + a];
        for (a = 16; a <= 79; a++) A[a] = o(A[a - 3] ^ A[a - 8] ^ A[a - 14] ^ A[a - 16], 1);
        for (n = g, C = i, c = s, f = S, d = m, a = 0; a <= 19; a++) u = o(n, 5) + (C & c | ~C & f) + d + A[a] + 1518500249 & 4294967295, d = f, f = c, c = o(C, 30), C = n, n = u;
        for (a = 20; a <= 39; a++) u = o(n, 5) + (C ^ c ^ f) + d + A[a] + 1859775393 & 4294967295, d = f, f = c, c = o(C, 30), C = n, n = u;
        for (a = 40; a <= 59; a++) u = o(n, 5) + (C & c | C & f | c & f) + d + A[a] + 2400959708 & 4294967295, d = f, f = c, c = o(C, 30), C = n, n = u;
        for (a = 60; a <= 79; a++) u = o(n, 5) + (C ^ c ^ f) + d + A[a] + 3395469782 & 4294967295, d = f, f = c, c = o(C, 30), C = n, n = u;
        g = g + n & 4294967295, i = i + C & 4294967295, s = s + c & 4294967295, S = S + f & 4294967295, m = m + d & 4294967295
    }
    return (u = e(g) + e(i) + e(s) + e(S) + e(m)).toLowerCase()
