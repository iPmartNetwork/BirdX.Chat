import { useEffect, useRef, useState } from "react";
import { Plus, Close } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { getAvatarInitials } from "../../utils/avatarInitials.js";

/**
 * Stories Carousel — horizontal scrollable ring at the top of the sidebar.
 * Each ring represents a user who has active stories.
 * Clicking opens the story viewer overlay.
 */
export function StoriesCarousel({ users = [], currentUser, onViewStory, onCreateStory }) {
  const { t } = useLanguage();
  const scrollRef = useRef(null);

  return (
    <div className="border-b border-slate-100 px-2 py-2 dark:border-white/10">
      <div ref={scrollRef} className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
        {/* Add story button */}
        <button
          type="button"
          onClick={onCreateStory}
          className="flex shrink-0 flex-col items-center gap-1"
          aria-label={t("stories.addStory") || "Add story"}
        >
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
            <Plus size={20} className="text-emerald-500" />
          </div>
          <span className="max-w-[64px] truncate text-[10px] text-slate-500 dark:text-slate-400">
            My story
          </span>
        </button>

        {/* User story rings */}
        {users.map((user) => {
          const hasUnviewed = user.stories?.some((s) => !s.viewed);
          return (
            <button
              key={user.userId}
              type="button"
              onClick={() => onViewStory?.(user)}
              className="flex shrink-0 flex-col items-center gap-1"
              aria-label={`View ${user.nickname || user.username}'s story`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${
                  hasUnviewed
                    ? "border-emerald-500"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: user.color || "#10b981" }}
                  >
                    {getAvatarInitials(user.nickname || user.username)}
                  </div>
                )}
              </div>
              <span className="max-w-[56px] truncate text-[10px] text-slate-600 dark:text-slate-300">
                {user.nickname || user.username}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Story Viewer — fullscreen overlay showing stories one by one.
 */
export function StoryViewer({ user, stories = [], onClose, onView, onNext, onPrev }) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef(null);

  const story = stories[currentIndex] || null;

  // Auto-advance after 5 seconds
  useEffect(() => {
    if (!story) return;
    onView?.(story.id);
    timerRef.current = setTimeout(() => {
      if (currentIndex < stories.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        onNext?.() || onClose?.();
      }
    }, 5000);
    return () => clearTimeout(timerRef.current);
  }, [currentIndex, story?.id]);

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onNext?.() || onClose?.();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      onPrev?.();
    }
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/95">
      {/* Progress bars */}
      <div className="absolute left-4 right-4 top-4 flex gap-1">
        {stories.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className={`h-full rounded-full transition-all duration-[5000ms] ${
                i < currentIndex
                  ? "w-full bg-white"
                  : i === currentIndex
                    ? "w-full bg-white animate-[progress_5s_linear]"
                    : "w-0 bg-white"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute left-4 right-4 top-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: user?.color || "#10b981" }}
          >
            {getAvatarInitials(user?.nickname || user?.username)}
          </div>
          <span className="text-sm font-semibold text-white">
            {user?.nickname || user?.username}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/20"
          aria-label="Close"
        >
          <Close size={20} />
        </button>
      </div>

      {/* Story content */}
      <div className="flex h-full w-full items-center justify-center px-12 py-20">
        {story.type === "text" ? (
          <div
            className="flex max-w-md items-center justify-center rounded-2xl p-8 text-center text-xl font-bold text-white"
            style={{ backgroundColor: story.backgroundColor || "#10b981", minHeight: "300px", minWidth: "280px" }}
          >
            {story.body}
          </div>
        ) : story.mediaUrl ? (
          story.mediaType?.startsWith("video/") ? (
            <video
              src={story.mediaUrl}
              autoPlay
              playsInline
              muted
              className="max-h-[80vh] max-w-full rounded-xl object-contain"
            />
          ) : (
            <img
              src={story.mediaUrl}
              alt=""
              className="max-h-[80vh] max-w-full rounded-xl object-contain"
            />
          )
        ) : (
          <div className="flex items-center justify-center rounded-2xl bg-slate-800 p-8 text-lg text-white">
            {story.body || "Story"}
          </div>
        )}
      </div>

      {/* Navigation */}
      <button
        type="button"
        onClick={goPrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        aria-label="Previous"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <button
        type="button"
        onClick={goNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        aria-label="Next"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  );
}
