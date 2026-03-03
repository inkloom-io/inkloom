/**
 * Collaboration utilities for real-time editing features
 */

// Predefined colors for user cursors (visually distinct and accessible)
const USER_COLORS = [
  "#F44336", // Red
  "#E91E63", // Pink
  "#9C27B0", // Purple
  "#673AB7", // Deep Purple
  "#3F51B5", // Indigo
  "#2196F3", // Blue
  "#03A9F4", // Light Blue
  "#00BCD4", // Cyan
  "#009688", // Teal
  "#4CAF50", // Green
  "#8BC34A", // Light Green
  "#CDDC39", // Lime
  "#FFC107", // Amber
  "#FF9800", // Orange
  "#FF5722", // Deep Orange
] as const;

/**
 * Generates a consistent color for a user based on their ID
 * The same user ID will always get the same color
 */
export function getUserColor(userId: string): string {
  // Simple hash function to convert userId to a number
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get an index
  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index] as string;
}

/**
 * User presence information in a collaborative session
 */
export interface CollaborationUser {
  id: string;
  name: string;
  avatar: string | null;
  color: string;
}

/**
 * Awareness state for a user (includes cursor position, selection, etc.)
 */
export interface AwarenessState {
  user: CollaborationUser;
  cursor?: {
    anchor: number;
    head: number;
  } | null;
}

/**
 * Gets the display name for a user, with fallback
 */
export function getUserDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  // Use email username as fallback
  return email.split("@")[0] ?? email;
}

/**
 * Gets initials for avatar fallback
 */
export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Lighter version of a color for backgrounds
 */
export function getLighterColor(hex: string, opacity: number = 0.2): string {
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
}
