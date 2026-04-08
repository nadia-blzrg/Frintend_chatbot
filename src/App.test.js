import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders chatbot title", () => {
  render(<App />);
  const title = screen.getByText(/demo chatbot i-yusr/i);
  expect(title).toBeInTheDocument();
});
