// The sweep is a CSS animation (see .rb-shiny in App.css), so it costs no JS per frame
// and stops automatically under prefers-reduced-motion.
export default function ShinyText({
  text,
  children,
  color = '#94a3b8',
  shineColor = '#ffffff',
  speed = 2.8,
  delay = 0.5,
  angle = 120,
  shineWidth = 45,
  glow = 0.35,
  className = '',
  style
}) {
  const content = children ?? text;
  const half = Math.min(50, Math.max(5, shineWidth / 2));

  return (
    <span
      className={`rb-shiny relative inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, ${color} 0%, ${color} ${50 - half}%, ${shineColor} 50%, ${color} ${50 + half}%, ${color} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        '--rb-shiny-duration': `${speed + delay}s`,
        filter: glow > 0 ? `drop-shadow(0 0 ${glow * 8}px ${shineColor}40)` : undefined,
        ...style
      }}
    >
      {content}
    </span>
  );
}
