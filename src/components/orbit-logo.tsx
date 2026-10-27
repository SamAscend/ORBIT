import Image from "next/image";

export function OrbitLogo({ className }: { className?: string }) {
  return <Image src="/images/orbit-logo.png" alt="ORBIT" width={1524} height={375} className={className} priority />;
}

export function OrbitSymbol({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  return <Image src="/images/orbit-symbol.png" alt={decorative ? "" : "ORBIT"} aria-hidden={decorative} width={532} height={375} className={className} />;
}
