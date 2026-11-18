import { useEffect, useRef, useState } from "react";

export type GameChatMessage = {
  id: string;
  name: string;
  text: string;
};

export function GameChat({
  open,
  messages,
  onSend,
  onClose,
}: {
  open: boolean;
  messages: GameChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <section className="game-chat" aria-label="Game chat">
      <div className="game-chat-messages" aria-live="polite">
        {messages.slice(-8).map((message) => (
          <p key={message.id}>
            <strong>{message.name}</strong> {message.text}
          </p>
        ))}
        {messages.length === 0 && <p className="game-chat-empty">No messages yet.</p>}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = text.trim().slice(0, 240);
          if (value) onSend(value);
          setText("");
        }}
      >
        <input
          ref={inputRef}
          aria-label="Chat message"
          maxLength={240}
          value={text}
          placeholder="Message (Enter to send)"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") onClose();
          }}
        />
        <button type="submit" disabled={!text.trim()}>
          SEND
        </button>
      </form>
      <span className="game-chat-hint">T or ESC to close</span>
    </section>
  );
}
