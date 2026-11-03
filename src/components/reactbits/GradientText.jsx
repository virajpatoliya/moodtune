// The flow is a CSS animation (see .rb-gradient in App.css): the colour list is doubled and the
// background is twice as wide, so shifting it by one width loops seamlessly.
export default function GradientText({
  children,
  colors = ['#c4b5fd', '#f472b6', '#fb923c', '#c4b5fd'],
  animationSpeed = 6,
  angle = 90,
  glow = 0.4,
  className = '',
  style
}) {
  const gradientStops = [...colors, ...colors].join(', ');

  return (
    <span
      className={`rb-gradient inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, ${gradientStops})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        '--rb-gradient-duration': `${animationSpeed}s`,
        filter: glow > 0 ? `drop-shadow(0 0 ${glow * 12}px rgba(196,181,253,0.35))` : undefined,
        ...style
      }}
    >
      {children}
    </span>
  );
}
