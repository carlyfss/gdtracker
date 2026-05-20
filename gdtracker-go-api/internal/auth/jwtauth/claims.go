package jwtauth

const customClaimGDTrackerUserID = "https://gdtracker.io/gdtracker_user_id"

// Claims holds validated Auth0 access-token fields used by the API.
type Claims struct {
	Sub             string
	Username        string
	GDTrackerUserID string
}
