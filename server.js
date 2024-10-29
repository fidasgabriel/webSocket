const WebSocket = require("ws");

const server = new WebSocket.Server({ port: 8080 });
const clients = new Map();
const usernames = new Set();
const messages = [];

server.on("connection", (ws) => {
  console.log("Cliente novo conectado");

  ws.on("message", (message) => {
    let msgObject;
    try {
      msgObject = JSON.parse(message);
    } catch (e) {
      console.error("Erro: ", e);
      return;
    }

    if (msgObject.action === "join") {
      const username = msgObject.username;
      if (!usernames.has(username)) {
        usernames.add(username);
        clients.set(ws, { user: username, status: "online" });
        broadcast(
          JSON.stringify({
            message: `${username} entrou na conversa`,
            type: "data",
          })
        );
        ws.send(JSON.stringify({ type: "history", messages }));
        updateClientsList();
      }
    } else if (msgObject.action === "typing") {
      broadcast(
        JSON.stringify({
          type: "typing",
          message: `${msgObject.username} digita bastante...`,
        })
      );
    } else if (clients.has(ws)) {
      const { username, message } = msgObject;

      if (message.startsWith("/private ")) {
        const [_, recipient, ...msgParts] = message.split(" ");
        const privateMessage = msgParts.join(" ");
        sendPrivateMessage(username, recipient, privateMessage);
      } else {
        const fullMessage = `${username}: ${message}`;
        messages.push(fullMessage);
        broadcast(
          JSON.stringify({
            message: fullMessage,
            type: "message",
          })
        );
      }
    }
  });

  ws.on("close", () => {
    const clientData = clients.get(ws);
    if (clientData) {
      const username = clientData.user;
      clients.delete(ws);
      usernames.delete(username);
      broadcast(
        JSON.stringify({
          message: `${username} saiu da conversa`,
          type: "data",
        })
      );
      updateClientsList();
    }
  });
});

function updateClientsList() {
  const cl = Array.from(usernames).map((user) => ({ user, status: "online" }));
  broadcast(JSON.stringify({ cl, type: "list" }));
}

function broadcast(message) {
  for (const client of clients.keys()) {
    client.send(message);
  }
}

function sendPrivateMessage(sender, recipient, message) {
  const recipientWs = Array.from(clients.entries()).find(
    ([_, client]) => client.user === recipient
  )?.[0];
  const senderWs = Array.from(clients.entries()).find(
    ([_, client]) => client.user === sender
  )?.[0];

  if (recipientWs === senderWs) {
    recipientWs.send(
      JSON.stringify({
        message: `Não é pra enviar mensagens pra si mesmo`,
        type: "data",
      })
    );
    return;
  }
  if (recipientWs) {
    recipientWs.send(
      JSON.stringify({
        message: `${sender} (só pra você): ${message}`,
        type: "message",
      })
    );
    senderWs.send(
      JSON.stringify({
        message: `${sender} (enviada somente para ${recipient}): ${message}`,
        type: "message",
      })
    );
  } else {
    const senderWs = Array.from(clients.entries()).find(
      ([_, client]) => client.user === sender
    )?.[0];
    if (senderWs) {
      senderWs.send(
        JSON.stringify({
          message: `${recipient} não está online.`,
          type: "data",
        })
      );
    }
  }
}
