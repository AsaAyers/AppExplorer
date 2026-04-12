import {
  formatDate,
  isValidEmail,
  deepClone,
  generateId,
} from "../utils/helpers";

export interface UserProfileProps {
  userId: string;
  displayName: string;
  email: string;
  avatar?: string;
  joinedAt?: Date | string;
  bio?: string;
}

export interface ProfileSession {
  sessionId: string;
  startedAt: Date;
}

export class UserProfile {
  private props: UserProfileProps;
  private session: ProfileSession;

  constructor(props: UserProfileProps) {
    this.props = props;
    this.session = {
      sessionId: generateId(12),
      startedAt: new Date(),
    };
  }

  /**
   * Render the user profile component
   */
  render(): string {
    const joinedLine = this.props.joinedAt
      ? `<p class="joined">Joined ${this.getFormattedJoinDate()}</p>`
      : "";
    const bioLine = this.props.bio
      ? `<p class="bio">${this.props.bio}</p>`
      : "";
    const emailStatus = isValidEmail(this.props.email) ? "" : " (invalid)";

    return `
      <div class="user-profile">
        <img src="${this.props.avatar || "/default-avatar.png"}" alt="Avatar" />
        <h2>${this.props.displayName}</h2>
        <p class="email">${this.props.email}${emailStatus}</p>
        ${bioLine}
        ${joinedLine}
      </div>
    `;
  }

  /**
   * Update user profile data. Returns false if the email update is invalid.
   */
  updateProfile(updates: Partial<UserProfileProps>): boolean {
    if (updates.email !== undefined && !isValidEmail(updates.email)) {
      return false;
    }
    this.props = { ...this.props, ...updates };
    return true;
  }

  /**
   * Get a snapshot of the current profile data (deep cloned).
   */
  getSnapshot(): UserProfileProps {
    return deepClone(this.props);
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.props.userId;
  }

  /**
   * Get the active session info for this profile view.
   */
  getSession(): ProfileSession {
    return this.session;
  }

  /**
   * Format the user's join date for display.
   */
  getFormattedJoinDate(): string | null {
    if (!this.props.joinedAt) return null;
    return formatDate(this.props.joinedAt);
  }
}
