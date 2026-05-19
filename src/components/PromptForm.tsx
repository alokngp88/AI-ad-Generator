import { useState } from 'react';
import { Sparkles } from 'lucide-react';

type Props = {
  onGenerate: (text: string) => void;
  loading: boolean;
  placeholder: string;
};

export default function PromptForm({
  onGenerate,
  loading,
  placeholder,
}: Props) {
  const [text, setText] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim()) onGenerate(text.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full p-3 border border-gray-200 rounded-xl
                   text-sm resize-none focus:outline-none
                   focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="w-full flex items-center justify-center gap-2
                   bg-blue-600 text-white py-2.5 rounded-xl
                   text-sm font-medium disabled:opacity-50
                   hover:bg-blue-700 transition-colors"
      >
        <Sparkles size={16} />
        {loading ? 'Generating...' : 'Generate'}
      </button>
    </form>
  );
}
