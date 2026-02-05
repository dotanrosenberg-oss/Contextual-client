import { useState, KeyboardEvent } from "react";
import { X, Plus, Trash2, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PollComposerProps {
  onSend: (question: string, options: string[], allowMultipleAnswers: boolean) => void;
  onCancel: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;

export function PollComposer({
  onSend,
  onCancel,
  isLoading = false,
  disabled = false,
}: PollComposerProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultipleAnswers, setAllowMultipleAnswers] = useState(false);

  const handleAddOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > MIN_OPTIONS) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === options.length - 1 && options.length < MAX_OPTIONS) {
        handleAddOption();
      }
    }
  };

  const handleSend = () => {
    const trimmedQuestion = question.trim();
    const validOptions = options.map(o => o.trim()).filter(o => o.length > 0);
    
    if (trimmedQuestion && validOptions.length >= MIN_OPTIONS) {
      onSend(trimmedQuestion, validOptions, allowMultipleAnswers);
    }
  };

  const validOptions = options.filter(o => o.trim().length > 0);
  const canSend = question.trim().length > 0 && validOptions.length >= MIN_OPTIONS && !isLoading && !disabled;

  return (
    <div className="border rounded-lg bg-card shadow-sm" data-testid="poll-composer">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-medium text-sm">Create Poll</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          disabled={isLoading}
          data-testid="button-cancel-poll"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-3 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="poll-question">Question</Label>
          <Input
            id="poll-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            disabled={disabled || isLoading}
            maxLength={255}
            data-testid="input-poll-question"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  placeholder={`Option ${index + 1}`}
                  disabled={disabled || isLoading}
                  maxLength={100}
                  data-testid={`input-poll-option-${index}`}
                />
                {options.length > MIN_OPTIONS && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(index)}
                    disabled={isLoading}
                    data-testid={`button-remove-option-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          {options.length < MAX_OPTIONS && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              disabled={isLoading}
              className="w-full"
              data-testid="button-add-option"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add option
            </Button>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="allow-multiple" className="text-sm text-muted-foreground">
            Allow multiple answers
          </Label>
          <Switch
            id="allow-multiple"
            checked={allowMultipleAnswers}
            onCheckedChange={setAllowMultipleAnswers}
            disabled={disabled || isLoading}
            data-testid="switch-allow-multiple"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-2 p-3 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          data-testid="button-poll-cancel"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          disabled={!canSend}
          data-testid="button-send-poll"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Poll"
          )}
        </Button>
      </div>
    </div>
  );
}
