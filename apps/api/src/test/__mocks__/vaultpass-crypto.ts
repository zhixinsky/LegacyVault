export const verifyChallengeAnswer = jest.fn(() => true);
export const hashChallengeAnswer = jest.fn(() => ({ salt: 'mock', hash: 'mock' }));
export const normalizeChallengeAnswer = (value: string) => value.trim().toLowerCase();
