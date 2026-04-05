type ShellLoaderProps = {
  className?: string;
};

export function ShellLoader({ className }: ShellLoaderProps) {
  return (
    <div className={className ? `app-shell-loader ${className}` : "app-shell-loader"}>
      <span className="app-shell-loader-cell" />
      <span className="app-shell-loader-cell" />
      <span className="app-shell-loader-cell" />
      <span className="app-shell-loader-cell" />
    </div>
  );
}
