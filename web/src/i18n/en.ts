/** English is the source of truth for message keys. German must implement the same keys. */
export const en = {
  // Common
  "app.name": "Nanocore",
  "common.loading": "Loading…",
  "common.cancel": "Cancel",
  "common.create": "Create",
  "common.creating": "Creating…",
  "common.saving": "Saving…",
  "common.open": "Open",
  "common.rename": "Rename",
  "common.delete": "Delete",
  "common.remove": "Remove",
  "common.signOut": "Sign out",
  "common.admin": "admin",
  "common.optional": "Optional",
  "common.language": "Language",
  "common.english": "English",
  "common.german": "Deutsch",

  // Roles / status
  "role.admin": "admin",
  "role.member": "member",
  "status.tempPassword": "temp password",
  "status.active": "active",

  // Setup
  "setup.title": "Welcome — set up your workspace",
  "setup.subtitle":
    "Create your organization and the first admin account. You can invite people after this.",
  "setup.orgName": "Organization / team name",
  "setup.orgNamePlaceholder": "Acme Design",
  "setup.displayName": "Your display name",
  "setup.displayNamePlaceholder": "Ada Lovelace",
  "setup.adminEmail": "Admin email",
  "setup.emailPlaceholder": "you@company.com",
  "setup.password": "Password (min 8 characters)",
  "setup.submit": "Create workspace",
  "setup.failed": "Setup failed",

  // Login
  "login.title": "Sign in",
  "login.subtitle":
    "Accounts are created by an admin — there is no public registration.",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.signingIn": "Signing in…",
  "login.failed": "Login failed",

  // Change password
  "password.title": "Choose a new password",
  "password.subtitleTemp":
    "Your admin set a temporary password. Pick a new one to continue.",
  "password.subtitleUpdate": "Update your password.",
  "password.current": "Current password",
  "password.new": "New password (min 8 characters)",
  "password.confirm": "Confirm new password",
  "password.save": "Save password",
  "password.mismatch": "New passwords do not match",
  "password.failed": "Could not change password",

  // Shell
  "nav.users": "Users",
  "nav.boards": "Boards",
  "nav.allBoards": "All boards",

  // Boards
  "boards.title": "Boards",
  "boards.subtitle": "Shared infinite canvases for your team.",
  "boards.new": "New board",
  "boards.creating": "Creating…",
  "boards.empty": "No boards yet. Create one to start collaborating.",
  "boards.createFirst": "Create your first board",
  "boards.defaultName": "Untitled board",
  "boards.renamePrompt": "Board name",
  "boards.deleteConfirm": "Delete “{name}”? This cannot be undone.",
  "boards.updated": "Updated {date}",
  "boards.loadFailed": "Failed to load boards",
  "boards.createFailed": "Could not create board",
  "boards.renameFailed": "Rename failed",
  "boards.deleteFailed": "Delete failed",

  // Board canvas
  "board.missingId": "Missing board id",
  "board.openFailed": "Could not open board",
  "board.backToBoards": "Back to boards",
  "board.loadingName": "Loading…",
  "board.loadingSession": "Loading session…",
  "board.connecting": "Connecting to board…",
  "board.connectionError": "Connection error: {message}",
  "board.apiHint": "Is the API running on port 3001?",
  "board.anonymous": "Anonymous",
  "board.uploadFailed": "Upload failed",

  // Users
  "users.title": "Users",
  "users.subtitle": "Only admins can create accounts.",
  "users.backToBoards": "← Back to boards",
  "users.add": "Add user",
  "users.colName": "Name",
  "users.colEmail": "Email",
  "users.colRole": "Role",
  "users.colStatus": "Status",
  "users.removeConfirm": "Remove {email}?",
  "users.loadFailed": "Failed to load users",
  "users.deleteFailed": "Delete failed",
  "users.createTitle": "Add user",
  "users.createHelp":
    "They sign in with this email and temporary password, then must choose a new password.",
  "users.displayName": "Display name",
  "users.email": "Email",
  "users.tempPassword": "Temporary password",
  "users.createFailed": "Could not create user",

  // People menu (presence)
  "people.title": "People on this board",
  "people.nameManaged": "Name is set by your organization",
  "people.you": "You",
  "people.jump": "Jump to user",
  "people.follow": "Follow",
  "people.following": "Following",
  "people.stopFollowing": "Stop following",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
