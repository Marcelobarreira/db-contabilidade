'use client';

type LogoutButtonProps = {
  className?: string;
  children: React.ReactNode;
};

export default function LogoutButton({ className, children }: LogoutButtonProps) {
  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button className={className} onClick={handleLogout}>
      {children}
    </button>
  );
}
