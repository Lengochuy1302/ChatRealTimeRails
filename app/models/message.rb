class Message < ApplicationRecord
  belongs_to :user

  validates :content, presence: true
  validates :room, presence: true

  scope :in_room, ->(room) { where(room: room) }
  scope :recent_messages, -> { order(created_at: :desc).limit(50) }
end
