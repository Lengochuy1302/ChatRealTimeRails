# Rails Realtime Chat Application

Ứng dụng chat realtime được xây dựng với Ruby on Rails, ActionCable và MySQL. Ứng dụng cho phép người dùng chat realtime trong các phòng chat khác nhau.

## Công nghệ sử dụng

- Ruby on Rails 8.0.2
- MySQL
- Redis (cho ActionCable)
- WebSocket (thông qua ActionCable)
- Bootstrap 5
- Font Awesome 6

## Cài đặt

### Yêu cầu hệ thống

- Ruby 3.x
- Rails 8.x
- MySQL
- Redis
- Node.js và Yarn

### Các bước cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd myapp
```

2. Cài đặt dependencies:
```bash
bundle install
yarn install
```

3. Thiết lập database:
```bash
rails db:create
rails db:migrate
```

4. Khởi động Redis server:
```bash
sudo service redis-server start
```

5. Khởi động Rails server:
```bash
rails server
```

## Cấu trúc ứng dụng

### 1. Database Schema

```ruby
# db/migrate/YYYYMMDDHHMMSS_create_messages.rb
class CreateMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :messages do |t|
      t.text :content
      t.references :user, null: false, foreign_key: true
      t.string :room

      t.timestamps
    end
  end
end
```

### 2. Models

```ruby
# app/models/message.rb
class Message < ApplicationRecord
  belongs_to :user
  validates :content, presence: true
  validates :room, presence: true
  
  scope :in_room, ->(room) { where(room: room) }
  scope :recent_messages, -> { order(created_at: :desc).limit(50) }
end

# app/models/user.rb
class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable
  has_many :messages
end
```

### 3. ActionCable Setup

#### Channel Configuration

```ruby
# app/channels/application_cable/connection.rb
module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      if verified_user = env['warden'].user
        verified_user
      else
        reject_unauthorized_connection
      end
    end
  end
end

# app/channels/chat_channel.rb
class ChatChannel < ApplicationCable::Channel
  def subscribed
    @room = params[:room]
    stream_from "chat_#{@room}"
    logger.info "Subscribed to chat_#{@room} by user #{current_user.email}"
  end

  def unsubscribed
    logger.info "Unsubscribed from chat_#{@room} by user #{current_user.email}"
    stop_all_streams
  end

  def speak(data)
    logger.info "Received message: #{data['message']} in room: #{@room}"
    
    message = Message.new(
      content: data['message'],
      user: current_user,
      room: @room
    )

    if message.save
      logger.info "Message saved successfully with ID: #{message.id}"
      broadcast_message(message)
    else
      logger.error "Failed to save message: #{message.errors.full_messages}"
      transmit(error: message.errors.full_messages)
    end
  rescue => e
    logger.error "Error in ChatChannel#speak: #{e.message}"
    transmit(error: "Failed to process message")
  end

  private

  def broadcast_message(message)
    html = ApplicationController.renderer.render(
      partial: 'messages/message',
      locals: { 
        message: message,
        current_user: message.user
      }
    )

    ActionCable.server.broadcast(
      "chat_#{@room}",
      {
        message: html,
        message_id: message.id
      }
    )
  end
end
```

### 4. Frontend Implementation

#### JavaScript Setup

```javascript
// public/js/cable.js
function createConsumer() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.hostname;
  const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  const wsURL = `${wsProtocol}//${wsHost}:${wsPort}/cable`;
  console.log("Connecting to WebSocket at:", wsURL);
  return ActionCable.createConsumer(wsURL);
}

window.createConsumer = createConsumer;

// public/js/chat.js
document.addEventListener('DOMContentLoaded', function() {
  if (typeof ActionCable === 'undefined') {
    console.error('ActionCable is not loaded yet');
    return;
  }

  const consumer = createConsumer();
  console.log("Created ActionCable consumer");

  function initializeChat() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const room = messagesContainer.dataset.room;
    
    const subscription = consumer.subscriptions.create(
      { channel: "ChatChannel", room: room },
      {
        connected() {
          console.log("Connected to chat room:", room);
        },

        disconnected() {
          console.log("Disconnected from chat room:", room);
        },

        received(data) {
          if (data.error) {
            console.error("Error received:", data.error);
            return;
          }

          if (data.message) {
            messagesContainer.insertAdjacentHTML('beforeend', data.message);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        },

        speak(message) {
          return this.perform('speak', { message: message });
        }
      }
    );

    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const message = input.value.trim();
      if (message.length > 0) {
        subscription.speak(message);
        input.value = '';
      }
    });
  }

  initializeChat();
});
```

### 5. Views

#### Chat Room View
```erb
# app/views/chats/show.html.erb
<div class="chat-container">
  <div class="chat-header">
    <div class="chat-header-content">
      <h2><i class="fas fa-comments"></i> Chat Room: <%= @room %></h2>
      <div class="online-status">
        <span class="status-dot"></span>
        <span class="status-text">Online</span>
      </div>
    </div>
  </div>

  <div class="messages-container">
    <div class="messages" id="messages" data-room="<%= @room %>">
      <%= render @messages %>
    </div>
  </div>

  <div class="chat-footer">
    <form id="chat-form" class="chat-form">
      <div class="input-group">
        <input type="text" 
               id="chat-input" 
               class="form-control" 
               placeholder="Type your message..." 
               autocomplete="off"
               required>
        <button type="submit" class="send-button">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </form>
  </div>
</div>
```

#### Message Partial
```erb
# app/views/messages/_message.html.erb
<div class="message <%= message.user == current_user ? 'current-user' : '' %>">
  <div class="message-content">
    <div class="message-header">
      <% if message.user != current_user %>
        <span class="username"><%= message.user.email.split('@').first %></span>
      <% end %>
      <span class="timestamp"><%= time_ago_in_words(message.created_at) %> ago</span>
    </div>
    <div class="message-text">
      <%= message.content %>
    </div>
  </div>
</div>
```

### 6. Controller

```ruby
# app/controllers/chats_controller.rb
class ChatsController < ApplicationController
  before_action :authenticate_user!

  def show
    @room = params[:room] || "general"
    @messages = Message.in_room(@room).includes(:user).order(created_at: :desc).limit(50).reverse
  end
end
```

### 7. Routes

```ruby
# config/routes.rb
Rails.application.routes.draw do
  devise_for :users
  
  get 'chat/:room', to: 'chats#show', as: :chat
  root 'chats#show'

  mount ActionCable.server => '/cable'
end
```

## Cấu hình

### ActionCable Configuration

```ruby
# config/cable.yml
development:
  adapter: redis
  url: redis://localhost:6379/1

test:
  adapter: test

production:
  adapter: redis
  url: <%= ENV.fetch("REDIS_URL") { "redis://localhost:6379/1" } %>
  channel_prefix: myapp_production
```

## Tính năng

1. **Xác thực người dùng**
   - Đăng ký/đăng nhập với Devise
   - Xác thực WebSocket connections

2. **Chat Realtime**
   - Gửi và nhận tin nhắn ngay lập tức
   - Hỗ trợ nhiều phòng chat
   - Hiển thị trạng thái online

3. **UI/UX**
   - Giao diện responsive
   - Hiệu ứng và animations
   - Tùy chỉnh thanh cuộn
   - Hiển thị thời gian tin nhắn

4. **Xử lý lỗi**
   - Logging chi tiết
   - Thông báo lỗi cho người dùng
   - Tự động kết nối lại khi mất kết nối

## Bảo mật

1. **WebSocket**
   - Xác thực kết nối
   - CSRF protection
   - Kiểm tra quyền truy cập phòng

2. **Database**
   - Validation dữ liệu
   - Foreign key constraints
   - SQL injection prevention

## Deployment

1. **Yêu cầu server**
   - Ruby 3.x
   - Redis server
   - MySQL database
   - Nginx (recommended)

2. **Biến môi trường**
   - `REDIS_URL`
   - `DATABASE_URL`
   - `SECRET_KEY_BASE`

3. **SSL/TLS**
   - Cấu hình SSL cho WebSocket
   - Chuyển đổi ws:// thành wss://

## Phát triển thêm

1. **Tính năng có thể thêm**
   - Đính kèm file/hình ảnh
   - Emoji picker
   - Typing indicators
   - Read receipts
   - Mention users
   - Rich text formatting

2. **Cải thiện hiệu suất**
   - Message pagination
   - WebSocket connection pooling
   - Database indexing
   - Cache optimization

## Troubleshooting

1. **Kết nối WebSocket**
   - Kiểm tra Redis server
   - Xác nhận URL WebSocket
   - Kiểm tra logs

2. **Database**
   - Kiểm tra migrations
   - Xác nhận associations
   - Kiểm tra validations

3. **JavaScript**
   - Console errors
   - Network requests
   - Event listeners

## Contributing

Hướng dẫn đóng góp cho dự án:
1. Fork repository
2. Tạo branch mới
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## License

MIT License
