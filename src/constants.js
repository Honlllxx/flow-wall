import React from 'react';
import { Activity, BookOpen, Coffee, Zap, Star, Code, Music, Heart, Hash, Smile } from 'lucide-react';

export const ICON_MAP = {
  'book': <BookOpen size={20} />,
  'activity': <Activity size={20} />,
  'zap': <Zap size={20} />,
  'coffee': <Coffee size={20} />,
  'star': <Star size={20} />,
  'code': <Code size={20} />,
  'music': <Music size={20} />,
  'heart': <Heart size={20} />,
  'hash': <Hash size={20} />,
  'smile': <Smile size={20} />,
};

export const AVAILABLE_ICONS = ['star', 'code', 'music', 'heart', 'hash', 'smile', 'book', 'activity', 'zap', 'coffee'];
export const DEFAULT_COLORS = ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];

export const STANDARD_RANGES = [
  { id: 'raw', label: 'Latest' },
  { id: 'hour', label: 'Today' },
  { id: 'day', label: '7 Days' },
  { id: 'week', label: '12 Weeks' },
  { id: 'month', label: '12 Months' },
  { id: 'year', label: 'Year' },
];