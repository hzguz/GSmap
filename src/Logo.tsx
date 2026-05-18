import logoUrl from "./logo.svg?url";

type Props = {
  size?: number;
  className?: string;
};

export function Logo({ size = 24, className }: Props) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}
