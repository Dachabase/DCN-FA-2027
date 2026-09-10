import { Loader2, AlertTriangle, Inbox } from "lucide-react";
import "./states.scss";

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="uif-state">
      <Loader2 size={22} className="uif-state__spin" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message = "Something went wrong loading this. Please try again." }) {
  return (
    <div className="uif-state uif-state--error">
      <AlertTriangle size={22} />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ message = "Nothing here yet." }) {
  return (
    <div className="uif-state">
      <Inbox size={22} />
      <span>{message}</span>
    </div>
  );
}
