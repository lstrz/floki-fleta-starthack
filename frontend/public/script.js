var canvasW = 1024;
var canvasH = 1024;
var canvasPadding = 30;
var colors = new Array(canvasW * canvasH).fill(0);
var prices = new Array(canvasW * canvasH).fill(0);
var times = new Array(canvasW * canvasH).fill(0);
var canvas;
var ctx;

function initialize() {
    canvas = document.getElementById('flace-canvas');
    ctx = canvas.getContext('2d');

    $.get("/api/board", function (resp) {
        var board = resp.board;
        canvasW = board.Width;
        canvasH = board.Height;
        for (i = 0; i < canvasW; ++i) {
            for (j = 0; j < canvasH; ++j) {
                var off = j * canvasW + i;
                colors[off] = "#" + board.Cells[off].Color.toString(16).padStart(6, "0");
                prices[off] = board.Cells[off].Price;
                times[off] = board.Cells[off].CreationTime;
            }
        }
        initializeCont();
    });
}

function initializeCont() {
    ctx.canvas.width = canvasW;
    ctx.canvas.height = canvasH;

    ctx.imageSmoothingEnabled = false;
    for (i = 0; i < canvasW; ++i) {
        for (j = 0; j < canvasH; ++j) {
            var off = j * canvasW + i;
            setPixel(i, j, colors[off]);
        }
    }
    // var ws = new WebSocket("ws://localhost:31337");
    // window.ws = null;
    // ws.onopen = function () {
    //     window.ws = ws;
    // };

    // ws.onmessage = function (evt) {
    //     var msg = JSON.parse(evt.data);
    //     setPixel(msg.x, msg.y, msg.color);
    // };

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

    window.color = color;
    window.price = price;
    window.scaleFactor = 1;

    resizeCanvas();
}

function hoverPrice(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    var x = Math.floor((event.clientX - rect.left) / window.scaleFactor);
    var y = Math.floor((event.clientY - rect.top) / window.scaleFactor);
    document.getElementById('current_price').innerHTML = prices[y * canvasW + x];
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

    var bid = parseInt(window.price.value);
    if(bid <= prices[y * canvasW + x]) {
        alert("Price of the selected pixel is higher than your offer");
        return;
    }

    $.post("/api/games/" + window.address + "/commands/paint", JSON.stringify({
        "utxo": utxo,
        "x": x,
        "y": y,
        "color": parseInt(window.color.value.substring(1), 16),
        "amount": parseInt(window.price.value)
    }), function (resp) {
        $("#paint-result1").html(JSON.stringify(resp));

        var msg = new Buffer(resp.hash_hex, "hex");
        var sig = window.key.sign(msg);
        var SIG_HEX = buf2hex(sig.r.toArrayLike(Buffer, "be", 32)) + buf2hex(sig.s.toArrayLike(Buffer, "be", 32)) + "0" + sig.recoveryParam;

        $.post("/api/games/" + window.address + "/commands/commit", JSON.stringify({
            "type": resp.type,
            "tx_hex": resp.tx_hex,
            "sig_hex": SIG_HEX
        }), function (resp) {
            $("#paint-result2").html(JSON.stringify(resp));
        }).error(function (resp) {
            $("#paint-result2").html(JSON.stringify(resp));
        });
    }).error(function (resp) {
        $("#paint-result1").html(JSON.stringify(resp));
    });
}


function setPixel(x, y, color) {
    window.ctx.fillStyle = color;
    window.ctx.fillRect(x, y, 1, 1);
}

function resizeCanvas() {
    var scaleX = (window.innerWidth - canvasPadding) / window.canvas.width;
    var scaleY = (window.innerHeight - canvasPadding) / window.canvas.height;

    var scaleToFit = Math.min(scaleX, scaleY) * window.scaleFactor;

    window.scaleFactor = scaleToFit;
    window.canvas.width = canvasW * scaleToFit;
    window.canvas.height = canvasH * scaleToFit;
    window.ctx.scale(scaleToFit, scaleToFit);

    for (i = 0; i < canvasW; ++i) {
        for (j = 0; j < canvasH; ++j) {
            var off = j * canvasW + i;
            setPixel(i, j, colors[off]);
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

    $.post("/api/accounts", JSON.stringify({
        "public_key": pk,
        "user_id": userId,
    }), function (data) {
        $("#register-result").html(JSON.stringify(data));
    }).error(function (data) {
        $("#register-result").html(JSON.stringify(data));
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

    $.get("/api/accounts?pubkey=" + pk, function (res) {
        window.address = res.address;
        window.utxos = res.utxos;
        window.key = key;
        $("#login-result").html(JSON.stringify(res));

        if (location.protocol != 'https:') {
            var wsUri = "ws://" + window.location.host + "/websocket/" + window.address;
        } else {
            var wsUri = "wss://" + window.location.host + "/websocket/" + window.address;
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
        $("body").toggleClass('state-login state-game');
    }).error(function (data) {
        $("#login-result").html(JSON.stringify(data));
    });
}
