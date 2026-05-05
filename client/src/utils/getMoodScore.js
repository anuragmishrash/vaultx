export const MOOD_SCORES = { great: 5, good: 4, neutral: 3, stressed: 2, sad: 1, angry: 1 };

export const getMoodScore = (mood) => MOOD_SCORES[mood] || 3;

export const MOOD_EMOJIS = {
  great: '😄',
  good: '🙂',
  neutral: '😐',
  stressed: '😤',
  sad: '😢',
  angry: '😠',
};

export const MOOD_LABELS = {
  great: 'Great',
  good: 'Good',
  neutral: 'Neutral',
  stressed: 'Stressed',
  sad: 'Sad',
  angry: 'Angry',
};

export const MOOD_COLORS = {
  great: '#00C896',
  good: '#4E9FFF',
  neutral: '#8A8FA8',
  stressed: '#F5A623',
  sad: '#8B7CF6',
  angry: '#FF5A5A',
};
