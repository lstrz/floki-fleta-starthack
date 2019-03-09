#!/usr/bin/env python

import asyncio
import websockets


async def hello(websocket, path):
    while (True):
        msg = await websocket.recv()
        print("recv: {}".format(msg))
        await websocket.send("{}".format(msg))
        print("send: {}".format(msg))


start_server = websockets.serve(hello, 'localhost', 31337)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
