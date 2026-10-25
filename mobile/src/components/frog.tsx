import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

import FrogBorrower from "@/assets/mascot/frog-borrower.svg";
import FrogCelebrate from "@/assets/mascot/frog-celebrate.svg";
import FrogEmpty from "@/assets/mascot/frog-empty.svg";
import FrogHappy from "@/assets/mascot/frog-happy.svg";
import FrogNewLoan from "@/assets/mascot/frog-new-loan.svg";
import FrogOffline from "@/assets/mascot/frog-offline.svg";
import FrogPayment from "@/assets/mascot/frog-payment.svg";
import FrogReminder from "@/assets/mascot/frog-reminder.svg";
import FrogSearchEmpty from "@/assets/mascot/frog-search-empty.svg";
import FrogSyncing from "@/assets/mascot/frog-syncing.svg";
import FrogThinking from "@/assets/mascot/frog-thinking.svg";
import FrogWelcome from "@/assets/mascot/frog-welcome.svg";

const MOODS = {
  borrower: FrogBorrower,
  celebrate: FrogCelebrate,
  empty: FrogEmpty,
  happy: FrogHappy,
  newLoan: FrogNewLoan,
  offline: FrogOffline,
  payment: FrogPayment,
  reminder: FrogReminder,
  searchEmpty: FrogSearchEmpty,
  syncing: FrogSyncing,
  thinking: FrogThinking,
  welcome: FrogWelcome,
} satisfies Record<string, FC<SvgProps>>;

export type FrogMood = keyof typeof MOODS;

interface FrogProps {
  mood: FrogMood;
  size?: number;
}

/** Bai the Frog. Decorative: screen readers skip it. */
export function Frog({ mood, size = 96 }: FrogProps) {
  const Art = MOODS[mood];
  return (
    <Art
      width={size}
      height={size}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
