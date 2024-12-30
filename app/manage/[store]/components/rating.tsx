import React, { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const ratingVariants = {
  default: {
    star: "text-foreground",
    emptyStar: "text-muted-foreground",
  },
  destructive: {
    star: "text-red-500",
    emptyStar: "text-red-200",
  },
  yellow: {
    star: "text-yellow-500",
    emptyStar: "text-muted-foreground",
  },
};

interface RatingsProps extends React.HTMLAttributes<HTMLDivElement> {
  rating: number;
  totalStars?: number;
  size?: number;
  fill?: boolean;
  precision?: number; // Precision for fractional ratings
  Icon?: React.ReactElement;
  variant?: keyof typeof ratingVariants;
  onRatingChange?: (rating: number) => void;
  disabled?: boolean;
}

export const CommentRatings = ({
  rating: initialRating,
  totalStars = 5,
  size = 20,
  fill = true,
  precision = 0.5,
  Icon = <Star />,
  variant = "default",
  onRatingChange,
  disabled = false,
  ...props
}: RatingsProps) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [currentRating, setCurrentRating] = useState(initialRating);
  const [focusRating, setFocusRating] = useState(initialRating); // Used for keyboard navigation

  const calculateFractionalRating = (
    event: React.MouseEvent<HTMLDivElement>,
    starIndex: number
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const fillFraction = Math.min(Math.max(offsetX / rect.width, 0), 1); // Fractional position within the star
    const preciseRating = starIndex - 1 + fillFraction;
    return parseFloat(
      (Math.round(preciseRating / precision) * precision).toFixed(2)
    );
  };

  const handleMouseMove = (
    event: React.MouseEvent<HTMLDivElement>,
    starIndex: number
  ) => {
    if (!disabled) {
      const preciseRating = calculateFractionalRating(event, starIndex);
      setHoverRating(preciseRating);
    }
  };

  const handleMouseLeave = () => {
    setHoverRating(null);
  };

  const handleClick = (
    event: React.MouseEvent<HTMLDivElement>,
    starIndex: number
  ) => {
    if (!disabled) {
      const preciseRating = calculateFractionalRating(event, starIndex);
      setCurrentRating(preciseRating);
      setFocusRating(preciseRating);
      if (onRatingChange) {
        onRatingChange(preciseRating);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    let newRating = focusRating;

    switch (event.key) {
      case "ArrowRight":
        newRating = Math.min(focusRating + precision, totalStars); // Increment rating
        break;
      case "ArrowLeft":
        newRating = Math.max(focusRating - precision, 0); // Decrement rating
        break;
      case "Enter":
      case " ":
        setCurrentRating(newRating); // Save the new rating on Enter or Space
        if (onRatingChange) {
          onRatingChange(newRating);
        }
        break;
      default:
        return;
    }

    event.preventDefault(); // Prevent default browser behavior
    setFocusRating(newRating);
  };

  const displayRating = disabled
    ? initialRating
    : hoverRating ?? focusRating ?? currentRating;

  return (
    <div
      className={cn(
        "flex w-fit flex-col gap-2 focus-visible:outline-none group",
        {
          "pointer-events-none": disabled,
        }
      )}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-valuenow={currentRating}
      aria-valuemin={0}
      aria-valuemax={totalStars}
      aria-label="Rating"
      {...props}
    >
      <div className="flex gap-[1px] items-center w-fit group-focus-visible:ring-1 group-focus-visible:ring-ring group-focus-visible:rounded-md p-[1px]">
        {[...Array(totalStars)].map((_, i) => {
          const starValue = i + 1;
          const isFull = displayRating >= starValue;
          const isPartial =
            displayRating > starValue - 1 && displayRating < starValue;
          const partialFill = isPartial ? displayRating - (starValue - 1) : 0;

          return (
            <div
              key={i}
              className={cn(
                "relative cursor-pointer transition-transform",
                isPartial
                  ? "group-focus-visible:scale-[1.15] group-hover:scale-[1.2]"
                  : "scale-1"
              )}
              onMouseMove={(e) => handleMouseMove(e, starValue)}
              onClick={(e) => handleClick(e, starValue)}
              style={{ width: size, height: size }}
            >
              {React.cloneElement(Icon, {
                size,
                className: cn(
                  fill && isFull ? "fill-current stroke-1" : "fill-transparent",
                  isFull
                    ? ratingVariants[variant].star
                    : ratingVariants[variant].emptyStar
                ),
              })}
              {isPartial && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${partialFill * 100}%`,
                    overflow: "hidden",
                    height: "100%",
                  }}
                >
                  {React.cloneElement(Icon, {
                    size,
                    className: cn("fill-current", ratingVariants[variant].star),
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground font-semibold">
        Classificação Atual: {displayRating.toFixed(1)}
      </span>
    </div>
  );
};
