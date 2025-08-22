package auth

import "errors"

// ValidateToken проверяет токен и возвращает userID.
// Заглушка: в реальном приложении здесь должна быть интеграция с Nakama.
func ValidateToken(token string) (string, error) {
	if token == "" {
		return "", errors.New("empty token")
	}
	// Заглушка: токен сам является userID.
	return token, nil
}
