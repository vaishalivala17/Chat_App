import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { API } from '../contexts/AuthContext';

export default function MessageInput({ targetUserId, groupId, onSend, disappearingSeconds = 0 }) {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const { sendTypingStart, sendTypingStop } = useSocket();
  const chatTarget = groupId || targetUserId;
  const isGroup = Boolean(groupId);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const videoInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const stopTyping = useCallback(() => {
    if (!isTyping) return;
    sendTypingStop(chatTarget, isGroup);
    setIsTyping(false);
  }, [isTyping, sendTypingStop, chatTarget, isGroup]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text]);

  useEffect(() => () => {
    clearTimeout(typingTimeoutRef.current);
    clearInterval(recordTimerRef.current);
    mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop();
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);

    if (!isTyping && value.trim()) {
      sendTypingStart(chatTarget, isGroup);
      setIsTyping(true);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 1500);
  };

  const sendPayload = (payload) => {
    onSend({ ...payload, disappearingSeconds });
  };

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;

    sendPayload({ content, messageType: 'text' });
    setText('');
    clearTimeout(typingTimeoutRef.current);
    stopTyping();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await API.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordTimerRef.current);
        setRecording(false);
        setRecordSeconds(0);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return;

        setUploading(true);
        try {
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
          const uploaded = await uploadFile(file);
          sendPayload({
            content: 'Voice message',
            messageType: uploaded.messageType,
            mediaUrl: uploaded.mediaUrl,
            mediaDuration: recordSeconds,
          });
        } catch {
          /* silent */
        } finally {
          setUploading(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      /* mic denied */
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleVideoSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      sendPayload({
        content: file.name || 'Video',
        messageType: uploaded.messageType,
        mediaUrl: uploaded.mediaUrl,
      });
    } catch {
      /* silent */
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      sendPayload({
        content: 'Photo',
        messageType: uploaded.messageType,
        mediaUrl: uploaded.mediaUrl,
      });
    } catch {
      /* silent */
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="shrink-0 p-3 border-t border-border bg-surface">
      {recording && (
        <div className="mb-2 flex items-center justify-between bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-2 text-sm text-red-300">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Recording {recordSeconds}s
          </span>
          <button onClick={stopRecording} className="text-xs font-semibold hover:underline">Stop & Send</button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-panel border border-border rounded-2xl px-3 py-2 focus-within:border-cyan/50 focus-within:ring-1 focus-within:ring-cyan/10 transition-all">
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploading || recording}
          title="Send image"
          className="p-1.5 rounded-lg text-muted hover:text-slate-300 hover:bg-card transition-colors mb-0.5 shrink-0 disabled:opacity-40"
        >
          <ImageIcon />
        </button>

        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          disabled={uploading || recording}
          title="Send video"
          className="p-1.5 rounded-lg text-muted hover:text-slate-300 hover:bg-card transition-colors mb-0.5 shrink-0 disabled:opacity-40"
        >
          <VideoIcon />
        </button>

        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={uploading}
          title={recording ? 'Stop recording' : 'Record voice message'}
          className={`p-1.5 rounded-lg transition-colors mb-0.5 shrink-0 disabled:opacity-40 ${
            recording ? 'text-red-400 bg-red-500/10' : 'text-muted hover:text-slate-300 hover:bg-card'
          }`}
        >
          <MicIcon />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading…' : 'Type a message… (Enter to send)'}
          disabled={recording || uploading}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-200 placeholder-muted py-1.5 leading-relaxed disabled:opacity-50"
          style={{ minHeight: '24px', maxHeight: '120px' }}
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || recording || uploading}
          className={`
            p-2 rounded-xl shrink-0 mb-0.5 transition-all duration-150
            ${text.trim() && !recording && !uploading
              ? 'bg-cyan text-base hover:bg-cyan-dim active:scale-95'
              : 'bg-card text-muted cursor-default'}
          `}
        >
          <SendIcon />
        </button>
      </div>
      <p className="text-center text-xs text-muted/60 mt-1.5 font-mono">
        Enter to send · Image · Video · Voice
      </p>
    </div>
  );
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zM19 11a7 7 0 01-14 0M12 18v3" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
