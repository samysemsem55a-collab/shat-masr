import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Hand, 
  Crown, 
  LogOut, 
  Radio, 
  ChevronDown, 
  ChevronUp, 
  Volume2, 
  VolumeX, 
  UserPlus, 
  Check, 
  X as XIcon, 
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { SpeakerSeat, User, Room } from '../types/chat';
import { sounds } from '../utils/soundEffects';

interface VoiceStageProps {
  room: Room;
  currentUser: User;
  onUpdateSpeakers: (newSpeakers: SpeakerSeat[]) => void;
  onSendSystemMessage: (content: string) => void;
  onOpenOnlineUsers: () => void;
  onOpenUserProfile: (user: User) => void;
}

export const VoiceStage: React.FC<VoiceStageProps> = ({
  room,
  currentUser,
  onUpdateSpeakers,
  onSendSystemMessage,
  onOpenOnlineUsers,
  onOpenUserProfile,
}) => {
  const [speakers, setSpeakers] = useState<SpeakerSeat[]>(room.speakers || []);
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(false);
  const [handRaised, setHandRaised] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState<boolean>(room.isVoiceActive);
  const [isLiveBroadcasting, setIsLiveBroadcasting] = useState<boolean>(room.isLiveBroadcasting !== false);
  
  // Pending mic/camera requests from listeners (starts empty, real users only)
  const [micRequests, setMicRequests] = useState<{ id: string; user: User; type?: 'mic' | 'camera' }[]>([]);
  const [cameraAllowedUserIds, setCameraAllowedUserIds] = useState<string[]>(room.cameraAllowedUserIds || []);

  // Host control strictly for the user who created the room (إنشاء فقط)
  const isHost = Boolean((room.ownerId && room.ownerId === currentUser.id) || (room.hostId && room.hostId === currentUser.id));
  const mySeat = speakers.find(s => s.user?.id === currentUser.id);

  // Host seat management popover state
  const [selectedSeatAction, setSelectedSeatAction] = useState<SpeakerSeat | null>(null);
  const [stageNotice, setStageNotice] = useState<string | null>(null);

  useEffect(() => {
    if (room.speakers && room.speakers.length > 0) {
      setSpeakers(room.speakers);
    } else {
      const isRoomCreator = Boolean(room.ownerId && room.ownerId === currentUser.id);
      const defaultSeats: SpeakerSeat[] = Array.from({ length: 6 }, (_, idx) => ({
        seatId: idx + 1,
        // Only seat currentUser in seat 1 if they created this room
        user: (idx === 0 && isRoomCreator) ? currentUser : null,
        isMuted: false,
        isTalking: (idx === 0 && isRoomCreator),
        isVideo: false,
      }));
      setSpeakers(defaultSeats);
    }
  }, [room.id]);

  const handleTakeSeat = (seatId: number) => {
    const existing = speakers.find(s => s.seatId === seatId);
    if (existing?.user) return;

    // If not host, require host approval or send hand raise request
    if (!isHost) {
      handleRaiseHand();
      return;
    }

    sounds.playMicToggle(true);
    const updated = speakers.map(s => {
      if (s.user?.id === currentUser.id) {
        return { ...s, user: null, isMuted: true, isTalking: false, isVideo: false };
      }
      if (s.seatId === seatId) {
        return { ...s, user: currentUser, isMuted: !isMicOn, isTalking: isMicOn, isVideo: isVideoOn };
      }
      return s;
    });
    setSpeakers(updated);
    onUpdateSpeakers(updated);
    setHandRaised(false);
    onSendSystemMessage(`🎤 صعد المضيف ${currentUser.name} على منصة التحدث في المقعد #${seatId}`);
  };

  const handleHostMuteSpeaker = (seatId: number) => {
    if (!isHost) return;
    const targetSeat = speakers.find(s => s.seatId === seatId);
    if (!targetSeat?.user) return;

    const newMuted = !targetSeat.isMuted;
    const updated = speakers.map(s => {
      if (s.seatId === seatId) {
        return { ...s, isMuted: newMuted, isTalking: !newMuted };
      }
      return s;
    });
    setSpeakers(updated);
    onUpdateSpeakers(updated);
    setSelectedSeatAction(null);
    onSendSystemMessage(`🔇 قام المضيف ${newMuted ? 'بكتم صوت' : 'بإلغاء كتم'} ${targetSeat.user.name}`);
  };

  const handleHostKickSpeaker = (seatId: number) => {
    if (!isHost) return;
    const targetSeat = speakers.find(s => s.seatId === seatId);
    if (!targetSeat?.user) return;

    const kickedUserName = targetSeat.user.name;
    const updated = speakers.map(s => {
      if (s.seatId === seatId) {
        return { ...s, user: null, isMuted: true, isTalking: false, isVideo: false };
      }
      return s;
    });
    setSpeakers(updated);
    onUpdateSpeakers(updated);
    setSelectedSeatAction(null);
    onSendSystemMessage(`🚪 قام المضيف بإنزال ${kickedUserName} من المايك إلى الجمهور`);
  };

  const handleLeaveSeat = () => {
    sounds.playMicToggle(false);
    const updated = speakers.map(s => {
      if (s.user?.id === currentUser.id) {
        return { ...s, user: null, isMuted: true, isTalking: false, isVideo: false };
      }
      return s;
    });
    setSpeakers(updated);
    onUpdateSpeakers(updated);
    onSendSystemMessage(`غادر ${currentUser.name} المايك إلى الجمهور`);
  };

  const toggleMic = () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    sounds.playMicToggle(nextState);
    const updated = speakers.map(s => {
      if (s.user?.id === currentUser.id) {
        return { ...s, isMuted: !nextState, isTalking: nextState };
      }
      return s;
    });
    setSpeakers(updated);
    onUpdateSpeakers(updated);
  };

  const toggleVideo = () => {
    const nextState = !isVideoOn;
    setIsVideoOn(nextState);
    const updated = speakers.map(s => {
      if (s.user?.id === currentUser.id) {
        return { ...s, isVideo: nextState };
      }
      return s;
    });
    setSpeakers(updated);
    onUpdateSpeakers(updated);
  };

  const handleRaiseHand = () => {
    setHandRaised(!handRaised);
    if (!handRaised) {
      sounds.playMessageSent();
      onSendSystemMessage(`✋ طلب ${currentUser.name} الصعود إلى المايك والتحدث في المجلس`);
      // Add to requests
      setMicRequests(prev => [
        ...prev.filter(r => r.user.id !== currentUser.id),
        { id: `req_${Date.now()}`, user: currentUser }
      ]);
    }
  };

  const handleAcceptRequest = (req: { id: string; user: User }) => {
    // Find empty seat
    const emptySeat = speakers.find(s => !s.user);
    if (!emptySeat) {
      setStageNotice('لا توجد مقاعد شاغرة حالياً!');
      setTimeout(() => setStageNotice(null), 3500);
      return;
    }

    sounds.playMicToggle(true);
    const updated = speakers.map(s => {
      if (s.seatId === emptySeat.seatId) {
        return { ...s, user: req.user, isMuted: false, isTalking: true, isVideo: false };
      }
      return s;
    });

    setSpeakers(updated);
    onUpdateSpeakers(updated);
    setMicRequests(prev => prev.filter(r => r.id !== req.id));
    onSendSystemMessage(`✅ وافق المضيف على طلب ${req.user.name} وصعد إلى المقعد #${emptySeat.seatId}`);
  };

  const handleDeclineRequest = (reqId: string) => {
    setMicRequests(prev => prev.filter(r => r.id !== reqId));
  };

  if (!isVoiceChatActive) {
    return (
      <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-xs text-slate-600">
        <span className="flex items-center gap-1.5 text-[11px]">
          <VolumeX className="w-3.5 h-3.5 text-slate-400" />
          الدردشة الصوتية مغلقة حالياً (وضع كتابي فقط)
        </span>
        {isHost && (
          <button
            onClick={() => setIsVoiceChatActive(true)}
            className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold"
          >
            تفعيل الصوت (المضيف)
          </button>
        )}
      </div>
    );
  }

  const activeSpeakersCount = speakers.filter(s => s.user !== null).length;

  return (
    <div className="bg-white/95 border-b border-slate-200 transition-all duration-300">
      
      {/* Collapsible Header Strip */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            مجلس الصوت ({activeSpeakersCount}/6)
          </span>

          {/* Host / Listener Badge */}
          {isHost ? (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>تحكم المضيف (إنشاؤك)</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[9.5px] font-medium flex items-center gap-1">
              <span>مستمع</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Host Live Toggle Button (خيار فتح اللايف للمضيف في الشاشة الصوتية) */}
          {isHost ? (
            isLiveBroadcasting ? (
              <button
                onClick={() => {
                  setIsLiveBroadcasting(false);
                  sounds.playMicToggle(false);
                  onSendSystemMessage(`⏹️ قام المضيف ${currentUser.name} بإنهاء البث المباشر (إيقاف اللايف).`);
                }}
                className="px-2 py-0.5 rounded-lg bg-red-950/80 border border-red-500 text-red-300 text-[9.5px] font-black flex items-center gap-1 animate-pulse hover:bg-red-900"
                title="إنهاء اللايف"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>لايف نشط 🔴</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsLiveBroadcasting(true);
                  sounds.playCoinsReward();
                  onSendSystemMessage(`🔴 قام المضيف ${currentUser.name} بفتح اللايف وبدء البث الصوتي المباشر للمجلس!`);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-[10px] font-black flex items-center gap-1 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-bounce"
                title="فتح اللايف للمستمعين"
              >
                <Radio className="w-3 h-3" />
                <span>فتح اللايف 🔴</span>
              </button>
            )
          ) : (
            isLiveBroadcasting ? (
              <span className="px-1.5 py-0.5 rounded-md bg-red-950/70 border border-red-500/50 text-red-300 text-[9px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                لايف مباشر
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[9px] font-bold">
                في الانتظار ⏳
              </span>
            )
          )}

          {/* Host Invite Button */}
          {isHost && (
            <button
              onClick={onOpenOnlineUsers}
              className="px-2 py-0.5 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-[10px] font-bold flex items-center gap-1"
              title="دعوة المتصلين للصعود إلى المايك"
            >
              <UserPlus className="w-3 h-3" />
              <span className="hidden xs:inline">دعوة متصلين</span>
            </button>
          )}

          {/* Toggle Voice / Text Mode (Host only) */}
          {isHost && (
            <button
              onClick={() => setIsVoiceChatActive(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              title="التحويل للوضع الكتابي فقط"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Expand / Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center gap-1 text-[10px] font-bold"
            title={isExpanded ? 'طي مجلس الصوت' : 'توسيع مجلس الصوت'}
          >
            {isExpanded ? (
              <>
                <span className="hidden sm:inline">إخفاء</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span className="hidden sm:inline">المجلس</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inline Stage Notice */}
      {stageNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-center text-[11px] font-bold text-amber-800">
          {stageNotice}
        </div>
      )}

      {/* Host Pending Mic Requests Notice */}
      {isHost && micRequests.length > 0 && isExpanded && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-1.5 text-amber-800 text-[11px] font-bold">
            <Hand className="w-3.5 h-3.5 animate-bounce text-amber-600" />
            <span>طلب صعود للمايك من {micRequests[0].user.name} ({micRequests[0].user.countryFlag})</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAcceptRequest(micRequests[0])}
              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-0.5"
            >
              <Check className="w-3 h-3" /> قبول
            </button>
            <button
              onClick={() => handleDeclineRequest(micRequests[0].id)}
              className="px-1.5 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-red-600 text-[10px]"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-2 sm:p-3 space-y-2.5 animate-in fade-in duration-200">
          
          {/* 6 Speaker Seats Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
            {speakers.slice(0, 6).map((seat) => {
              const user = seat.user;
              const isTalking = seat.isTalking && !seat.isMuted;

              return (
                <div
                  key={seat.seatId}
                  onClick={() => {
                    if (user) {
                      if (isHost && user.id !== currentUser.id) {
                        setSelectedSeatAction(seat);
                      } else {
                        onOpenUserProfile(user);
                      }
                    } else {
                      handleTakeSeat(seat.seatId);
                    }
                  }}
                  className={`relative flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-2xl cursor-pointer transition-all ${
                    user 
                      ? 'bg-slate-50 border border-slate-200 shadow-sm hover:border-indigo-300' 
                      : 'bg-slate-50/50 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                  }`}
                >
                  {/* Seat Number Tag */}
                  <span className="absolute top-1 left-1.5 text-[9px] font-black text-slate-400">
                    #{seat.seatId}
                  </span>

                  {/* Speaker Avatar or Empty Seat */}
                  <div className="relative my-0.5">
                    {user ? (
                      <div className="relative">
                        {/* Live Speaking Ring */}
                        {isTalking && (
                          <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping"></span>
                        )}

                        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-bold text-white text-xs shadow-sm ${
                          isTalking ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'border-white'
                        }`}>
                          {user.avatar ? (
                            <img 
                              src={user.avatar} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span>{user.name.charAt(0)}</span>
                          )}
                        </div>

                        {/* Mic Muted badge */}
                        <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-white text-[9px] ${
                          seat.isMuted ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                        }`}>
                          {seat.isMuted ? <MicOff className="w-2 h-2" /> : <Mic className="w-2 h-2" />}
                        </div>
                      </div>
                    ) : (
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500">
                        <Mic className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-bold">صعود</span>
                      </div>
                    )}
                  </div>

                  {/* User name & role */}
                  <div className="text-center w-full px-0.5">
                    {user ? (
                      <>
                        <p className="text-[10px] font-bold text-slate-800 truncate">
                          {user.name}
                        </p>
                        <p className="text-[9px] text-amber-600 font-semibold truncate">
                          {user.countryFlag} {seat.seatId === 1 ? 'المضيف' : user.vipBadge || 'عضو'}
                        </p>
                      </>
                    ) : (
                      <span className="text-[9px] text-slate-400">شاغر</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seat Controls Bar */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-2.5 py-1.5 border border-slate-200">
            {mySeat ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleMic}
                    className={`px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm transition-all ${
                      isMicOn 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    <span>{isMicOn ? 'المايك يعمل' : 'كتم'}</span>
                  </button>

                  <button
                    onClick={toggleVideo}
                    className={`p-1.5 rounded-xl text-xs font-bold ${
                      isVideoOn ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                    title="كاميرا"
                  >
                    {isVideoOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={handleLeaveSeat}
                  className="px-2.5 py-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>نزول للجمهور</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={handleRaiseHand}
                  className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    handRaised 
                      ? 'bg-amber-500 text-white font-black' 
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>{handRaised ? 'تم إرسال طلب التحدث ✋' : 'طلب الصعود للمايك'}</span>
                </button>

                <span className="text-[10px] text-slate-500">
                  انقر على مقعد شاغر أو اطلب المايك
                </span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Host Seat Action Modal (Only for Host in User-Created Room) */}
      {selectedSeatAction && selectedSeatAction.user && isHost && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-xs bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 text-center space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-black text-amber-600 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                تحكم المضيف بالمقعد #{selectedSeatAction.seatId}
              </span>
              <button 
                onClick={() => setSelectedSeatAction(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-right">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0">
                <img 
                  src={selectedSeatAction.user.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(selectedSeatAction.user.name || selectedSeatAction.user.id)}`} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-slate-900 truncate">{selectedSeatAction.user.name}</div>
                <div className="text-[10px] text-amber-600 font-semibold">{selectedSeatAction.user.countryFlag} {selectedSeatAction.user.vipBadge || 'عضو في المايك'}</div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <button
                onClick={() => handleHostMuteSpeaker(selectedSeatAction.seatId)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  selectedSeatAction.isMuted
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                {selectedSeatAction.isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>{selectedSeatAction.isMuted ? 'إلغاء كتم مايك المتحدث' : 'كتم مايك المتحدث 🔇'}</span>
              </button>

              <button
                onClick={() => handleHostKickSpeaker(selectedSeatAction.seatId)}
                className="w-full py-2 px-3 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>إنزال من المايك إلى الجمهور 🚪</span>
              </button>

              <button
                onClick={() => {
                  const targetUser = selectedSeatAction.user;
                  setSelectedSeatAction(null);
                  if (targetUser) onOpenUserProfile(targetUser);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-colors"
              >
                عرض الملف الشخصي الكامل
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
