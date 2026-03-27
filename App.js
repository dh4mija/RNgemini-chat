import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

const getDefaultBaseUrl = () => {
  const hostUri =
    Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return `http://${host}:3001`;
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
  return 'http://localhost:3001';
};

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || getDefaultBaseUrl();
const MAX_CONTEXT_MESSAGES = 20;
const STORAGE_KEY = '@gemini_chat_v2';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'model',
  content: '👋 Hi! I\'m Gemini. Ask me anything — I\'m here to help.',
};

// ─── Theme ────────────────────────────────────────────────────────────────────

const lightTheme = {
  bg: '#f4f1ec',
  surface: '#ffffff',
  surfaceAlt: '#f9fafb',
  border: '#e5e7eb',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  userBubble: '#2563eb',
  userText: '#ffffff',
  modelBubble: '#ffffff',
  modelText: '#111827',
  systemBubble: '#fef2f2',
  systemText: '#991b1b',
  systemBorder: '#fca5a5',
  sidebar: '#ffffff',
  sidebarBorder: '#e5e7eb',
  activeChat: '#eff6ff',
  activeChatBorder: '#bfdbfe',
  activeChatText: '#1d4ed8',
  deleteBtn: '#fef2f2',
  deleteBtnText: '#dc2626',
  sendBtn: '#2563eb',
  sendBtnText: '#ffffff',
  newChatBtn: '#111827',
  newChatBtnText: '#ffffff',
  menuBtn: '#ffffff',
  menuBtnText: '#111827',
  typingDot: '#6b7280',
  composerBg: '#f9fafb',
  inputBg: '#ffffff',
  placeholder: '#9ca3af',
  copyBtn: '#e5e7eb',
  copyBtnText: '#6b7280',
  headerBg: '#ffffff',
  shadow: 'rgba(0,0,0,0.06)',
};

const darkTheme = {
  bg: '#0f0f0f',
  surface: '#1a1a1a',
  surfaceAlt: '#111111',
  border: '#2a2a2a',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  userBubble: '#2563eb',
  userText: '#ffffff',
  modelBubble: '#1e1e1e',
  modelText: '#f1f5f9',
  systemBubble: '#2d1515',
  systemText: '#f87171',
  systemBorder: '#7f1d1d',
  sidebar: '#141414',
  sidebarBorder: '#2a2a2a',
  activeChat: '#1e3a5f',
  activeChatBorder: '#1d4ed8',
  activeChatText: '#93c5fd',
  deleteBtn: '#2d1515',
  deleteBtnText: '#f87171',
  sendBtn: '#2563eb',
  sendBtnText: '#ffffff',
  newChatBtn: '#2563eb',
  newChatBtnText: '#ffffff',
  menuBtn: '#1e1e1e',
  menuBtnText: '#f1f5f9',
  typingDot: '#94a3b8',
  composerBg: '#141414',
  inputBg: '#1e1e1e',
  placeholder: '#4b5563',
  copyBtn: '#2a2a2a',
  copyBtnText: '#94a3b8',
  headerBg: '#0f0f0f',
  shadow: 'rgba(0,0,0,0.3)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createChat = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: 'New chat',
  createdAt: Date.now(),
  messages: [WELCOME_MESSAGE],
});

const getChatTitle = (messages) => {
  const first = messages.find((m) => m.role === 'user');
  if (!first?.content) return 'New chat';
  const t = String(first.content).trim();
  return t.length > 30 ? `${t.slice(0, 30)}…` : t;
};

const formatTime = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(scheme === 'dark');
  const T = darkMode ? darkTheme : lightTheme;

  const initialChat = useMemo(() => createChat(), []);
  const [chats, setChats] = useState([initialChat]);
  const [activeChatId, setActiveChatId] = useState(initialChat.id);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [androidKeyboardOffset, setAndroidKeyboardOffset] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const listRef = useRef(null);
  const sidebarAnim = useRef(new Animated.Value(-280)).current;

  // ── Persist chats ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.chats?.length) {
            setChats(saved.chats);
            setActiveChatId(saved.activeChatId || saved.chats[0].id);
          }
        }
      } catch (_) {}
      setIsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chats, activeChatId })
    ).catch(() => {});
  }, [chats, activeChatId, isLoaded]);

  // ── Keyboard (Android) ───────────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setAndroidKeyboardOffset(Math.max(0, (e?.endCoordinates?.height || 0) + 8))
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setAndroidKeyboardOffset(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Sidebar animation ────────────────────────────────────────────────────

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: isSidebarOpen ? 0 : -280,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [isSidebarOpen]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || chats[0],
    [activeChatId, chats]
  );
  const messages = activeChat?.messages || [WELCOME_MESSAGE];

  const updateActiveChat = useCallback((updater) => {
    setChats((prev) =>
      prev.map((c) => (c.id !== activeChatId ? c : updater(c)))
    );
  }, [activeChatId]);

  // ── Chat management ───────────────────────────────────────────────────────

  const openNewChat = () => {
    const nc = createChat();
    setChats((prev) => [nc, ...prev]);
    setActiveChatId(nc.id);
    setInput('');
    setIsSidebarOpen(false);
  };

  const openChat = (id) => {
    setActiveChatId(id);
    setInput('');
    setIsSidebarOpen(false);
  };

  const deleteChat = (id) => {
    setChats((prev) => {
      if (prev.length <= 1) {
        const r = createChat();
        setActiveChatId(r.id);
        return [r];
      }
      const remaining = prev.filter((c) => c.id !== id);
      if (id === activeChatId) setActiveChatId(remaining[0].id);
      return remaining;
    });
  };

  const clearAllChats = () => {
    Alert.alert(
      'Clear all chats',
      'This will permanently delete all conversations. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            const fresh = createChat();
            setChats([fresh]);
            setActiveChatId(fresh.id);
            setIsSidebarOpen(false);
          },
        },
      ]
    );
  };

  // ── Copy message ──────────────────────────────────────────────────────────

  const copyMessage = async (text, id) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || !activeChat) return;

    const userMsg = {
      id: String(Date.now()),
      role: 'user',
      content: trimmed,
      ts: Date.now(),
    };
    const nextMessages = [...activeChat.messages, userMsg];

    setInput('');
    updateActiveChat((c) => ({
      ...c,
      messages: nextMessages,
      title: getChatTitle(nextMessages),
    }));
    setIsSending(true);
    setIsTyping(true);

    try {
      const context = nextMessages
        .filter((m) => m.role === 'user' || m.role === 'model')
        .slice(-MAX_CONTEXT_MESSAGES);

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: context }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${response.status}`);
      }

      const data = await response.json();
      const replyText = String(data.text || '').trim();

      if (replyText) {
        updateActiveChat((c) => ({
          ...c,
          messages: [
            ...c.messages,
            { id: `${Date.now()}-model`, role: 'model', content: replyText, ts: Date.now() },
          ],
        }));
      }
    } catch (error) {
      updateActiveChat((c) => ({
        ...c,
        messages: [
          ...c.messages,
          {
            id: `${Date.now()}-error`,
            role: 'system',
            content: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
            ts: Date.now(),
          },
        ],
      }));
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  };

  // ── Render message ────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';
    const canCopy = item.role === 'model' || item.role === 'user';
    const isCopied = copiedId === item.id;

    return (
      <View style={[s.msgRow, isUser ? s.msgRowRight : s.msgRowLeft]}>
        {!isUser && (
          <View style={[s.avatar, { backgroundColor: T.modelBubble, borderColor: T.border }]}>
            <Text style={{ fontSize: 13 }}>✨</Text>
          </View>
        )}
        <View style={{ maxWidth: '78%' }}>
          <View
            style={[
              s.bubble,
              {
                backgroundColor: isUser
                  ? T.userBubble
                  : isSystem
                  ? T.systemBubble
                  : T.modelBubble,
                borderColor: isSystem ? T.systemBorder : 'transparent',
                borderWidth: isSystem ? 1 : 0,
                shadowColor: T.shadow,
              },
            ]}
          >
            <Text
              style={[
                s.msgText,
                {
                  color: isUser
                    ? T.userText
                    : isSystem
                    ? T.systemText
                    : T.modelText,
                },
              ]}
            >
              {item.content}
            </Text>
          </View>
          {canCopy && (
            <TouchableOpacity
              style={[s.copyBtn, { backgroundColor: T.copyBtn, alignSelf: isUser ? 'flex-end' : 'flex-start' }]}
              onPress={() => copyMessage(item.content, item.id)}
              activeOpacity={0.7}
            >
              <Text style={[s.copyBtnText, { color: T.copyBtnText }]}>
                {isCopied ? '✓ Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {isUser && (
          <View style={[s.avatar, s.userAvatar, { backgroundColor: T.userBubble }]}>
            <Text style={{ fontSize: 13 }}>👤</Text>
          </View>
        )}
      </View>
    );
  }, [copiedId, T]);

  // ── Typing indicator ─────────────────────────────────────────────────────

  const listFooter = useMemo(() => {
    if (!isTyping) return <View style={{ height: 16 }} />;
    return (
      <View style={[s.msgRow, s.msgRowLeft]}>
        <View style={[s.avatar, { backgroundColor: T.modelBubble, borderColor: T.border }]}>
          <Text style={{ fontSize: 13 }}>✨</Text>
        </View>
        <View style={[s.bubble, { backgroundColor: T.modelBubble }]}>
          <View style={s.typingRow}>
            <ActivityIndicator size="small" color={T.typingDot} />
            <Text style={[s.typingText, { color: T.textSecondary }]}>Gemini is typing…</Text>
          </View>
        </View>
      </View>
    );
  }, [isTyping, T]);

  if (!isLoaded) {
    return (
      <View style={[s.loadingScreen, { backgroundColor: darkMode ? '#0f0f0f' : '#f4f1ec' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />

      {/* ── Sidebar overlay ── */}
      {isSidebarOpen && (
        <Pressable
          style={s.sidebarBackdrop}
          onPress={() => setIsSidebarOpen(false)}
        />
      )}
      <Animated.View
        style={[
          s.sidebar,
          {
            transform: [{ translateX: sidebarAnim }],
            backgroundColor: T.sidebar,
            borderRightColor: T.sidebarBorder,
            paddingTop: Math.max(20, insets.top + 8),
          },
        ]}
      >
        {/* Sidebar header */}
        <View style={[s.sidebarHeader, { borderBottomColor: T.border }]}>
          <Text style={[s.sidebarTitle, { color: T.text }]}>Conversations</Text>
          <TouchableOpacity onPress={() => setDarkMode((d) => !d)} style={[s.themeBtn, { backgroundColor: T.border }]}>
            <Text style={{ fontSize: 16 }}>{darkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* New chat button */}
        <TouchableOpacity
          style={[s.newChatBtn, { backgroundColor: T.newChatBtn }]}
          onPress={openNewChat}
          activeOpacity={0.85}
        >
          <Text style={[s.newChatBtnText, { color: T.newChatBtnText }]}>+ New Chat</Text>
        </TouchableOpacity>

        {/* Chat list */}
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isActive = item.id === activeChatId;
            return (
              <Pressable
                style={[
                  s.chatItem,
                  {
                    backgroundColor: isActive ? T.activeChat : 'transparent',
                    borderColor: isActive ? T.activeChatBorder : 'transparent',
                  },
                ]}
                onPress={() => openChat(item.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.chatItemTitle,
                      { color: isActive ? T.activeChatText : T.text },
                    ]}
                  >
                    {item.title}
                  </Text>
                  {item.createdAt && (
                    <Text style={[s.chatItemDate, { color: T.textMuted }]}>
                      {formatTime(item.createdAt)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[s.deleteBtn, { backgroundColor: T.deleteBtn }]}
                  onPress={() => deleteChat(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[s.deleteBtnText, { color: T.deleteBtnText }]}>✕</Text>
                </TouchableOpacity>
              </Pressable>
            );
          }}
        />

        {/* Clear all */}
        <TouchableOpacity
          style={[s.clearAllBtn, { borderColor: T.systemBorder }]}
          onPress={clearAllChats}
        >
          <Text style={[s.clearAllText, { color: T.deleteBtnText }]}>🗑 Clear all chats</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Main content ── */}
      <View style={s.main}>
        {/* Header */}
        <View
          style={[
            s.header,
            {
              paddingTop: Math.max(16, insets.top + 4),
              backgroundColor: T.headerBg,
              borderBottomColor: T.border,
              shadowColor: T.shadow,
            },
          ]}
        >
          <TouchableOpacity
            style={[s.menuBtn, { backgroundColor: T.menuBtn, borderColor: T.border }]}
            onPress={() => setIsSidebarOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={[s.menuBtnText, { color: T.menuBtnText }]}>☰</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: T.text }]}>Gemini Chat</Text>
            <Text style={[s.headerSub, { color: T.textSecondary }]}>
              {activeChat?.title !== 'New chat' ? activeChat?.title : 'Powered by Google Gemini'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.menuBtn, { backgroundColor: T.menuBtn, borderColor: T.border }]}
            onPress={openNewChat}
          >
            <Text style={{ fontSize: 18 }}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListFooterComponent={listFooter}
          contentContainerStyle={[s.listContent, { paddingBottom: 8 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* Composer */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <View
            style={[
              s.composer,
              {
                backgroundColor: T.composerBg,
                borderTopColor: T.border,
                paddingBottom:
                  Platform.OS === 'ios'
                    ? Math.max(12, insets.bottom + 6)
                    : androidKeyboardOffset > 0
                    ? 12
                    : Math.max(12, insets.bottom + 6),
                marginBottom: Platform.OS === 'android' ? androidKeyboardOffset : 0,
              },
            ]}
          >
            <TextInput
              style={[
                s.input,
                {
                  backgroundColor: T.inputBg,
                  borderColor: T.border,
                  color: T.text,
                },
              ]}
              placeholder="Message Gemini…"
              placeholderTextColor={T.placeholder}
              value={input}
              onChangeText={setInput}
              editable={!isSending}
              multiline
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[
                s.sendBtn,
                { backgroundColor: isSending || !input.trim() ? T.border : T.sendBtn },
              ]}
              onPress={sendMessage}
              disabled={isSending || !input.trim()}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  s.sendBtnText,
                  { color: isSending || !input.trim() ? T.textMuted : T.sendBtnText },
                ]}
              >
                {isSending ? '…' : '↑'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Sidebar
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    zIndex: 20,
    borderRightWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 20,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  themeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 10,
  },
  newChatBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
  },
  chatItemTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  chatItemDate: {
    fontSize: 11,
  },
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearAllBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Main
  main: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  headerCenter: { flex: 1, marginHorizontal: 10 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnText: {
    fontSize: 17,
  },

  // Messages
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    flexShrink: 0,
  },
  userAvatar: {
    marginRight: 0,
    marginLeft: 8,
    borderWidth: 0,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 22,
  },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontSize: 13,
  },

  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
});
