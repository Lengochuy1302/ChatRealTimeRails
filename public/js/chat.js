// Wait for ActionCable to be available
document.addEventListener('DOMContentLoaded', function() {
  if (typeof ActionCable === 'undefined') {
    console.error('ActionCable is not loaded yet');
    return;
  }

  // Create a consumer instance
  const consumer = createConsumer();
  console.log("Created ActionCable consumer");

  // Function to initialize chat
  function initializeChat() {
    console.log("Initializing chat...");
    
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) {
      console.log("Messages container not found");
      return;
    }

    const room = messagesContainer.dataset.room;
    console.log("Found messages container for room:", room);

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout;

    const subscription = consumer.subscriptions.create(
      { 
        channel: "ChatChannel",
        room: room
      },
      {
        connected() {
          console.log("Connected to chat room:", room);
          reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          this.scrollToBottom();
          this.perform('appear');
        },

        disconnected() {
          console.log("Disconnected from chat room:", room);
          
          // Try to reconnect if we haven't exceeded max attempts
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
            
            // Exponential backoff for reconnect
            const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            clearTimeout(reconnectTimeout);
            
            reconnectTimeout = setTimeout(() => {
              console.log("Attempting to resubscribe...");
              consumer.subscriptions.create({ channel: "ChatChannel", room: room });
            }, backoffTime);
          }
        },

        received(data) {
          console.log("Received data:", data);
          
          if (data.error) {
            console.error("Error received:", data.error);
            return;
          }

          if (data.message && messagesContainer) {
            console.log("Adding message to container");
            messagesContainer.insertAdjacentHTML('beforeend', data.message);
            this.scrollToBottom();
          }
        },

        rejected() {
          console.log("Subscription was rejected");
        },

        speak(message) {
          console.log("Sending message:", message);
          return this.perform('speak', { message: message });
        },

        scrollToBottom() {
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      }
    );

    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');

    if (!form || !input) {
      console.log("Form or input not found");
      return;
    }

    console.log("Setting up form submission handler");
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log("Form submitted");
      
      const message = input.value.trim();
      if (message.length > 0) {
        console.log("Sending message:", message);
        subscription.speak(message);
        input.value = '';
      }
    });

    // Handle Enter key
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        console.log("Enter key pressed");
        form.dispatchEvent(new Event('submit'));
      }
    });

    // Initial scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Clean up on page unload
    window.addEventListener('beforeunload', function() {
      subscription.perform('disappear');
      subscription.unsubscribe();
    });
  }

  // Initialize chat
  initializeChat();
});

// Log when the script loads
console.log("Chat.js loaded successfully"); 