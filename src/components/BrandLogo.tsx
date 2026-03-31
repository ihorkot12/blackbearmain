import React from 'react';

export const BrandLogo = ({ size = 'md', showKanji = false, align = 'center' }: { size?: 'sm' | 'md' | 'lg', showKanji?: boolean, align?: 'start' | 'center' }) => {
  const sizes = {
    sm: { text: 'text-[28px]', b: 'w-6 h-6 text-xs', spacing: 'gap-3', kanji: 'text-[7px]', line: 'h-[2px]' },
    md: { text: 'text-[36px]', b: 'w-8 h-8 text-sm', spacing: 'gap-4', kanji: 'text-[9px]', line: 'h-[2px]' },
    lg: { text: 'text-[42px] md:text-[56px]', b: 'w-10 h-10 md:w-14 md:h-14 text-lg md:text-2xl', spacing: 'gap-5 md:gap-6', kanji: 'text-[10px] md:text-sm', line: 'h-[2px]' },
  };
  const s = sizes[size];

  return (
    <div className={`flex flex-col ${align === 'center' ? 'items-center' : 'items-start'} ${size === 'lg' ? 'mb-10' : ''}`}>
      <div className={`flex items-center ${s.spacing} font-sans uppercase group cursor-pointer`}>
        {/* Skewed B Icon */}
        <div 
          className={`${s.b} bg-[#C10000] flex items-center justify-center shrink-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]`}
          style={{ clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0 100%)' }}
        >
          <span className="text-white font-black italic tracking-tighter">B</span>
        </div>
        
        {/* Text Part */}
        <div className={`${s.text} flex items-baseline gap-3 md:gap-4 whitespace-nowrap font-black tracking-tight leading-none`}>
          <div className="flex flex-col items-start relative pb-1">
            <span className="text-[#FFFFFF]">BLACK BEAR</span>
            <div className={`absolute bottom-0 left-0 w-full ${s.line} bg-gradient-to-r from-[#C8A400] to-[#E8C547]`} />
          </div>
          
          <div className="text-[#C10000] tracking-[0.06em] group-hover:drop-shadow-[0_0_10px_rgba(193,0,0,0.5)] transition-all duration-200" style={{ textShadow: '0 0 10px rgba(255,0,0,0.3)' }}>
            DOJO
          </div>
        </div>
      </div>
      
      {showKanji && (
        <div className={`${s.kanji} text-zinc-500 font-medium tracking-[1.5em] mt-6 uppercase opacity-50 select-none`}>
          極 真 空 手
        </div>
      )}
    </div>
  );
};
