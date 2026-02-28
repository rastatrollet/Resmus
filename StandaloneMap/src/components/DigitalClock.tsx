
import React, { useState, useEffect } from 'react';

export const DigitalClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const format = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="font-mono text-xl font-bold tracking-widest text-white/90 drop-shadow-sm flex items-baseline gap-[1px]">
      <span>{format(time.getHours())}:{format(time.getMinutes())}</span>
      <span className="text-sm opacity-80">:{format(time.getSeconds())}</span>
    </div>
  );
};
