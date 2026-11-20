type BrandLogoProps = {
  compact?: boolean;
};

export default function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2" aria-label="CollabSpace">
      <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        className={compact ? "h-8 w-8 shrink-0" : "h-11 w-11 shrink-0"}
      />
      <span className={`${compact ? "text-base" : "text-2xl"} font-bold tracking-tight text-white`}>
        Collab<span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 bg-clip-text text-transparent">Space</span>
      </span>
    </span>
  );
}
