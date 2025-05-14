class ChatsController < ApplicationController
  before_action :authenticate_user!

  def show
    @room = params[:room] || "general"
    @messages = Message.in_room(@room)
                      .includes(:user)
                      .recent_messages
                      .reverse
  end
end
