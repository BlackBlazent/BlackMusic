import placeholderAvatar from "@/assets/profile-placeholder.svg";
import type { AuthUser } from "@/app/context/AuthContext";
import "./ProfileCard.css";

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  facebook: "Facebook",
  spotify: "Spotify",
  email: "Email",
};

/** Profile picture, full name, email — shared by the account popover, modal and Settings → Account. */
export function ProfileCard({ user, size = 56 }: { user: AuthUser; size?: number }) {
  return (
    <div className="profile-card">
      <img
        className="profile-card__avatar"
        src={user.avatarUrl ?? placeholderAvatar}
        width={size}
        height={size}
        alt=""
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.currentTarget.src = placeholderAvatar;
        }}
      />
      <div className="profile-card__text">
        <span className="profile-card__name">{user.fullName ?? user.email?.split("@")[0] ?? "BlackMusic user"}</span>
        {user.email && <span className="profile-card__email">{user.email}</span>}
        <span className="profile-card__provider">Signed in with {PROVIDER_LABEL[user.provider] ?? user.provider}</span>
      </div>
    </div>
  );
}
