import WebSocket, { WebSocketServer } from "ws";

const receivingWSS = new WebSocketServer({ port: 42069 });
//const sendingWSS = new WebSocketServer({ path: "/sending", port: 42069 });
const recipients: WebSocket[] = [];
receivingWSS.on("connection", (ws, req) => {
    if (req.url === "/receive") {
        ws.on("message", (data) => {
            console.log("%s", data);
            recipients.forEach((wsss) => { wsss.send(data); });
        })
        ws.on("error", console.error);
        ws.on("close", () => { console.log("closed"); })
    }
    if (req.url === "/send") {
        console.log("new recipient");
        recipients.push(ws);
    }
});