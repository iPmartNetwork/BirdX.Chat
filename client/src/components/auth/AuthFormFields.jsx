import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { hasPersian } from "../../utils/fontUtils.js";
import { NICKNAME_MAX, USERNAME_MAX } from "../../utils/nameLimits.js";

const inputClassName =
  "w-full rounded-2xl border border-emerald-200/90 bg-white py-2.5 text-xs text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300/50 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-slate-100 sm:py-3 sm:text-sm";

const labelClassName =
  "text-xs font-semibold text-slate-700 dark:text-slate-200 sm:text-sm";

export default function AuthFormFields({
  isLogin,
  canSignup,
  requires2FA = false,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  loading,
  onSubmit,
  onReset,
}) {
  const { t } = useLanguage();
  const [nicknameHasPersian, setNicknameHasPersian] = useState(false);

  return (
    <form
      className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4"
      onSubmit={onSubmit}
      onReset={(event) => {
        setNicknameHasPersian(false);
        onReset?.(event);
      }}
    >
      {!isLogin && canSignup ? (
        <label className="block">
          <span className={labelClassName}>{t("auth.nickname")}</span>
          <input
            name="nickname"
            type="text"
            required
            placeholder="BirdX"
            maxLength={NICKNAME_MAX}
            onInput={(event) => {
              setNicknameHasPersian(
                hasPersian(String(event.currentTarget.value || "")),
              );
            }}
            lang={nicknameHasPersian ? "fa" : "en"}
            dir={nicknameHasPersian ? "rtl" : "ltr"}
            className={`${inputClassName} mt-1.5 px-3 sm:mt-2 sm:px-4 ${
              nicknameHasPersian ? "font-fa text-right" : "text-left"
            }`}
            style={{ unicodeBidi: "plaintext" }}
          />
        </label>
      ) : null}

      <label className="block">
        <span className={labelClassName}>{t("auth.username")}</span>
        <input
          name="username"
          type="text"
          required
          pattern="[a-zA-Z0-9._]+"
          title={t("auth.usernameHint")}
          autoCapitalize="none"
          autoComplete="username"
          placeholder="birdx.user"
          maxLength={USERNAME_MAX}
          dir="ltr"
          className={`${inputClassName} mt-1.5 px-3 text-left sm:mt-2 sm:px-4`}
          style={{ unicodeBidi: "plaintext" }}
        />
      </label>

      <label className="block">
        <span className={labelClassName}>{t("auth.password")}</span>
        <div className="relative mt-1.5 sm:mt-2">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 6}
            placeholder={showPassword ? "12345678" : "********"}
            className={`${inputClassName} px-3 pe-14 sm:px-4 sm:pe-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute end-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-emerald-700 transition hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-500/10 sm:h-9 sm:w-9"
            aria-label={
              showPassword ? t("auth.hidePassword") : t("auth.showPassword")
            }
          >
            {showPassword ? (
              <EyeOff size={16} className="icon-anim-peek" />
            ) : (
              <Eye size={16} className="icon-anim-peek" />
            )}
          </button>
        </div>
      </label>

      {!isLogin && canSignup ? (
        <label className="block">
          <span className={labelClassName}>{t("auth.confirmPassword")}</span>
          <div className="relative mt-1.5 sm:mt-2">
            <input
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              minLength={6}
              placeholder={showConfirmPassword ? "12345678" : "********"}
              className={`${inputClassName} px-3 pe-14 sm:px-4 sm:pe-16`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute end-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-emerald-700 transition hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-500/10 sm:h-9 sm:w-9"
              aria-label={
                showConfirmPassword
                  ? t("auth.hideConfirmPassword")
                  : t("auth.showConfirmPassword")
              }
            >
              {showConfirmPassword ? (
                <EyeOff size={16} className="icon-anim-peek" />
              ) : (
                <Eye size={16} className="icon-anim-peek" />
              )}
            </button>
          </div>
        </label>
      ) : null}

      {isLogin && requires2FA ? (
        <label className="block">
          <span className={labelClassName}>{t("auth.2faCode")}</span>
          <div className="relative mt-1.5 sm:mt-2">
            <input
              name="totpToken"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={9}
              placeholder="000000"
              autoFocus
              className={`${inputClassName} px-3 text-center text-lg font-bold tracking-[0.3em] sm:px-4`}
            />
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 sm:text-xs">
            {t("auth.2faHint")}
          </p>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 hover:shadow-emerald-500/35 disabled:cursor-not-allowed disabled:bg-emerald-400 disabled:text-white sm:px-4 sm:py-3 sm:text-sm"
      >
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin text-white" />
        ) : null}
        {isLogin ? t("auth.signIn") : t("auth.createAccount")}
      </button>
    </form>
  );
}
