var canvasW = 128;
var canvasH = 128;
var canvasPadding = 50;
var board = new Array(canvasW * canvasH).fill(0);

function initialize() {
    var canvas = document.getElementById('flace-canvas');
    var ctx = canvas.getContext('2d');

    ctx.canvas.width = canvasW;
    ctx.canvas.height = canvasH;

    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.imageSmoothingEnabled = false;
    for (i = 0; i < canvasW; ++i) {
        for (j = 0; j < canvasH; ++j) {
            ctx.fillRect(i, j, 1, 1);
        }
    }

    var ws = new WebSocket("ws://localhost:31337");
    window.ws = null;
    ws.onopen = function () {
        window.ws = ws;
    };

    ws.onmessage = function (evt) {
        var msg = JSON.parse(evt.data);
        setPixel(msg.x, msg.y, msg.color);
    };

    // ws.onclose = function() {
    //
    //     // websocket is closed.
    //     alert("Connection is closed...");
    // };

    canvas.addEventListener("mousedown", function (event) {
        sendRequest(canvas, event);
    });
    canvas.onmousemove = function (event) {
        hoverPrice(canvas, event);
    };

    var color = document.getElementById('color');
    var price = document.getElementById('price');

    window.canvas = canvas;
    window.ctx = ctx;
    window.color = color;
    window.price = price;
    window.scaleFactor = 1;
}

function hoverPrice(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    var x = Math.floor((event.clientX - rect.left) / window.scaleFactor);
    var y = Math.floor((event.clientY - rect.top) / window.scaleFactor);
    document.getElementById('current_price').innerHTML = board[y * canvasW + x];
}

function sendRequest(canvas, event) {
    if (window.address == null) {
        alert("Please login first");
        return;
    }

    var utxo = window.utxos[0];
    window.utxos.splice(0, 1);

    var rect = canvas.getBoundingClientRect();
    var x = Math.floor((event.clientX - rect.left) / window.scaleFactor);
    var y = Math.floor((event.clientY - rect.top) / window.scaleFactor);
    // if (window.ws != null) {
    //     window.ws.send(JSON.stringify({"x": x, "y": y, "color": window.color.value, "price": window.price.value}));
    // }

    $.post("/api/games/" + window.address + "/commands/add_count", {
        "x": x,
        "y": y,
        "color": window.color.value,
        "price": window.price.value
    }, function () {
        this.result1 = JSON.stringify(res.body);

        var data = res.body;
        var msg = new Buffer(data.hash_hex, "hex");
        var sig = window.key.sign(msg);
        var SIG_HEX = buf2hex(sig.r.toArrayLike(Buffer, "be", 32)) + buf2hex(sig.s.toArrayLike(Buffer, "be", 32)) + "0" + sig.recoveryParam;

        $.post("/api/games/" + window.address + "/commands/commit", {
            "type": data.type,
            "tx_hex": data.tx_hex,
            "sig_hex": SIG_HEX
        }, function (res) {
            this.result2 = JSON.stringify(res.body);
        });
    });

    console.log("x: " + x + " y: " + y);
}


function setPixel(x, y, color) {
    window.ctx.fillStyle = color;
    window.ctx.fillRect(x, y, 1, 1);
}

function resizeCanvas() {
    var scaleX = (window.innerWidth - canvasPadding) / window.canvas.width;
    var scaleY = (window.innerHeight - canvasPadding) / window.canvas.height;

    var scaleToFit = Math.min(scaleX, scaleY) * window.scaleFactor;
    console.log("Scale to fit: " + scaleToFit);

    window.scaleFactor = scaleToFit;
    window.canvas.width = canvasW * scaleToFit;
    window.canvas.height = canvasH * scaleToFit;
    window.ctx.scale(scaleToFit, scaleToFit);

    window.ctx.fillStyle = 'rgb(0, 0, 0)';
    for (i = 0; i < canvasW; ++i) {
        for (j = 0; j < canvasH; ++j) {
            ctx.fillRect(i, j, 1, 1);
        }
    }
}

function register() {
    var userId = document.getElementById('register-userid').value;
    if (userId.length == 0) {
        alert('Please, enter a UserID.');
        return;
    }

    var password = document.getElementById('register-password').value;
    if (password.length == 0) {
        alert('Please, enter a password.');
        return
    }

    var key = this.getKeyPair(userId, password);
    var pk = key.getPublic().encodeCompressed("hex");

    $.post("http://172.17.0.2:8080/api/accounts", JSON.stringify({
        "public_key": pk,
        "user_id": userId,
    }), function (data) {
        $(".register-result").html(JSON.stringify(data));
    }).error(function (data) {
        $(".register-result").html(JSON.stringify(data));
    });
}

function getKeyPair(userId, password) {
    userId = SHA2(userId);
    password = SHA2(password);
    var salt = SHA2("this is fleta sandbox");
    var keyHex = SHA2(userId + "#" + password + "#" + salt);
    return ec.keyPair({
        priv: keyHex,
        privEnc: "hex",
    });
}


function login() {
    var userId = document.getElementById('login-userid').value;
    if (userId.length == 0) {
        alert('Please, enter a UserID.');
        return;
    }

    var password = document.getElementById('login-password').value;
    if (password.length == 0) {
        alert('Please, enter a password.');
        return
    }

    var key = this.getKeyPair(userId, password);
    var pk = key.getPublic().encodeCompressed("hex");

    $.get("http://172.17.0.2:8080/api/accounts?pubkey=" + pk, function (res) {
        window.address = res.body.address;
        window.utxos = res.body.utxos;
        window.key = key;
        $(".login-result").html = JSON.stringify(res.body);

        if (location.protocol != 'https:') {
            var wsUri = "ws://http://172.17.0.2:8080/websocket/" + window.address;
        } else {
            var wsUri = "wss://http://172.17.0.2:8080/websocket/" + window.address;
        }

        function connect() {
            var ws = new WebSocket(wsUri)
            ws._init = false;
            ws.onopen = function (e) {
                onOpen(ws, e)
            };
            ws.onclose = function (e) {
                onClose(ws, e)
            };
            ws.onerror = function (e) {
                onError(ws, e)
            };
            ws.onmessage = function (e) {
                onMessage(ws, e)
            };
            return ws;
        }

        var ws = connect();
        var disconnectedCount = 0;

        function onOpen(ws, e) {
            disconnectedCount = 1;
            console.log("CONNECTED");
        }

        function onClose(ws, e) {
            disconnectedCount = (disconnectedCount + 1) * 2;
            console.log("DISCONNECTED");
            (function () {
                setTimeout(function () {
                    ws = connect();
                }, 1000 * disconnectedCount);
            })();
        }

        function onError(ws, e) {
            console.log("ERROR", e);
        }

        var _this = this;

        function onMessage(ws, e) {
            if (!ws._init) {
                ws._init = true;

                var msg = new Buffer(e.data, "hex");
                var sig = window.key.sign(msg);
                ws.send(buf2hex(sig.r.toArrayLike(Buffer, "be", 32)) + buf2hex(sig.s.toArrayLike(Buffer, "be", 32)) + "0" + sig.recoveryParam);
            } else {
                var noti = null;
                if (typeof e.data === "string") {
                    noti = JSON.parse(e.data);
                } else {
                    noti = e.data;
                }

                switch (noti.type) {
                    case "add_count": //AddCount
                        _this.push += "<br/>" + JSON.stringify(noti);
                        break;
                    case "__CONNECT__": //duplicated connection
                        alert("Duplicated Connection");
                        location.reload();
                        break;
                }
            }
        }
    });
}
