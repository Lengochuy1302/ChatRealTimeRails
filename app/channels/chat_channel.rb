class ChatChannel < ApplicationCable::Channel
  def subscribed
    @room = params[:room]
    stream_from "chat_#{@room}"
    logger.info "Subscribed to chat_#{@room} by user #{current_user.email}"
  end

  def unsubscribed
    logger.info "Unsubscribed from chat_#{@room} by user #{current_user.email}"
  end

  def speak(data)
    logger.info "Received message: #{data['message']} in room: #{@room} from user: #{current_user.email}"

    begin
      message = Message.new(
        content: data['message'],
        user: current_user,
        room: @room
      )

      if message.save
        logger.info "Message saved successfully with ID: #{message.id}"
        broadcast_message(message)
      else
        logger.error "Failed to save message: #{message.errors.full_messages.join(', ')}"
      end
    rescue => e
      logger.error "Error in ChatChannel#speak: #{e.message}"
      logger.error e.backtrace.join("\n")
    end
  end

  private

  def broadcast_message(message)
    logger.info "Broadcasting message ID: #{message.id} to room: #{message.room}"

    html = ApplicationController.renderer.render(
      partial: 'messages/message',
      locals: {
        message: message,
        current_user: message.user
      }
    )

    ActionCable.server.broadcast(
      "chat_#{message.room}",
      { message: html }
    )

    logger.info "Message broadcast completed"
  end
end
