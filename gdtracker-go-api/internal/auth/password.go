package auth

// EncodeUserPassword stores the password exactly as Spring PlainTextPasswordEncoder.encode does.
func EncodeUserPassword(plain string) string {
	return plain
}

// UserPasswordMatches mirrors Spring PlainTextPasswordEncoder.matches.
func UserPasswordMatches(plain, stored string) bool {
	if plain == "" || stored == "" {
		return false
	}
	return plain == stored
}
