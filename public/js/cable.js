// Action Cable setup
function createConsumer() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.hostname;
  const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  const wsURL = `${wsProtocol}//${wsHost}:${wsPort}/cable`;
  console.log("Connecting to WebSocket at:", wsURL);
  return ActionCable.createConsumer(wsURL);
}

// Make createConsumer available globally
window.createConsumer = createConsumer;

console.log("Cable.js loaded successfully"); 