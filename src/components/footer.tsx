export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-[#08090b] py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-display font-bold text-white mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display font-bold text-white mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Disclaimer</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display font-bold text-white mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Help center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display font-bold text-white mb-4">Follow</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
              <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 flex items-center justify-between">
          <p className="text-sm text-slate-400">© 2026 XE3AGLE. Discipline over impulse.</p>
          <p className="text-xs text-slate-500">Not financial advice. Trading carries risk.</p>
        </div>
      </div>
    </footer>
  );
}
