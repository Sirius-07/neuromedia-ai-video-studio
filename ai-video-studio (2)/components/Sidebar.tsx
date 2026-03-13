import { Plus, Film, MoreHorizontal } from 'lucide-react';

export function Sidebar() {
  return (
    <div className="w-full bg-white dark:bg-neutral-950 flex flex-col h-full shrink-0 transition-colors duration-500">
      <div className="p-4">
        <button className="w-full flex items-center justify-center gap-2 bg-white dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-900 dark:text-white py-2 px-4 rounded-lg transition-colors border border-neutral-200 dark:border-white/5 shadow-sm dark:shadow-none">
          <Plus size={16} />
          <span className="text-sm font-medium">New Project</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="text-[10px] font-medium text-neutral-500 mb-3 px-2 uppercase tracking-widest">Recent Projects</div>
        {/* Project Items */}
        {['Cyberpunk Cityscape', 'Nature Documentary', 'Tech Promo', 'Lofi Hip Hop Loop'].map((name, i) => (
          <div key={i} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group transition-colors ${i === 0 ? 'bg-cyan-50 dark:bg-white/10 text-cyan-700 dark:text-white' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <Film size={14} className={i === 0 ? 'text-cyan-500 dark:text-indigo-400' : 'text-neutral-400 dark:text-neutral-500'} />
              <span className="text-sm truncate">{name}</span>
            </div>
            <MoreHorizontal size={14} className="opacity-0 group-hover:opacity-100 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-opacity" />
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-neutral-200 dark:border-white/5 flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 shrink-0"></div>
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">Creator Account</div>
      </div>
    </div>
  );
}
