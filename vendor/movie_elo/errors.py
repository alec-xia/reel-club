"""Exceptions raised by the movie_elo package."""


class MovieEloError(Exception):
    """Base class for all errors raised by movie_elo."""


class ValidationError(MovieEloError, ValueError):
    """Input data is malformed or violates a rule of the game."""


class UnknownMemberError(ValidationError):
    """A suggester, rater, or voter is not a member of the league."""


class DuplicateWeekError(ValidationError):
    """A week with this ``week_id`` has already been processed."""
