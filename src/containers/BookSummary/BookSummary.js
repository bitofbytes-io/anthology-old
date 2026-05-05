import React, { Component } from "react";
import PropTypes from "prop-types";
import { v4 as uuidv4 } from "uuid";

import BookImage from "../../components/Book/BookImage/BookImage";
import Button from "../../components/UI/Button/Button";
import Input from "../../components/UI/Input/Input";
import { validateInput, validateForm } from "../../shared/utility";

import classes from "./BookSummary.module.scss";

const GOOGLE_BOOKS_API_KEY = process.env.REACT_APP_API_KEY;

class BookSummary extends Component {
  // bookForm contains dynamic input element configuration
  // that will be generated in the render() function
  state = {
    bookForm: {
      isbn: {
        elementType: "input",
        elementConfig: {
          type: "text",
          placeholder: "ISBN 10/13"
        },
        validation: {
          validISBN: true
        },
        value: this.props.book ? this.props.book.isbn : "",
        touched: false,
        valid: true
      },
      title: {
        elementType: "input",
        elementConfig: {
          type: "text",
          placeholder: "Book Title"
        },
        validation: {
          required: true
        },
        value: this.props.book ? this.props.book.title : "",
        touched: false,
        valid: false
      },
      author: {
        elementType: "input",
        elementConfig: {
          type: "text",
          placeholder: "Author"
        },
        validation: {
          required: true
        },
        value: this.props.book ? this.props.book.author : "",
        touched: false,
        valid: false
      },
      description: {
        elementType: "textarea",
        elementConfig: {
          type: "textarea",
          placeholder: "Description",
          rows: 4
        },
        value: this.props.book ? this.props.book.description : "",
        touched: false,
        valid: true
      },
      image: {
        elementType: "input",
        elementConfig: {
          type: "text",
          placeholder: "Image URL"
        },
        validation: {
          validURL: true
        },
        value: this.props.book ? this.props.book.image : "",
        touched: false,
        valid: true
      },
      loaned: {
        elementType: "input",
        elementConfig: {
          type: "checkbox"
        },
        checked: this.props.book ? this.props.book.loaned : false,
        touched: false,
        valid: true
      }
    }
  };

  // Add a instance of abortController to allow cancelling fetch
  // requests if user does not let the request finish
  abortController = new window.AbortController();

  componentDidMount = () => {
    // if adding a book, nothing to validate
    if (!this.props.book) {
      return;
    }

    // check if passed in book props are already valid
    let isFormValid = true;
    const newForm = { ...this.state.bookForm };
    for (let input in newForm) {
      newForm[input].valid = validateInput(newForm[input]);
      isFormValid = newForm[input].valid && isFormValid;
    }

    this.setState({
      bookForm: newForm,
      isFormValid
    });
  };

  componentWillUnmount = () => {
    // abort any pending fetch requests
    this.abortController.abort();
  };

  fetchBookDetails = () => {
    let url =
      "https://www.googleapis.com/books/v1/volumes?q=isbn:" +
      this.state.bookForm.isbn.value +
      "&key=" +
      GOOGLE_BOOKS_API_KEY;
    fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      signal: this.abortController.signal
    })
      .then(res => {
        if (res.status === 200) {
          return res.json();
        } else {
          return Promise.reject("Unable to get book details, don't update");
        }
      })
      .then(json => {
        // if received some book data
        if (json.items && json.items.length > 0) {
          if (json.items[0].volumeInfo) {
            let isFormValid = true;
            const newForm = { ...this.state.bookForm };

            // deconstruct values off valid JSON return
            let {
              title,
              authors,
              description,
              imageLinks
            } = json.items[0].volumeInfo;

            // trim description length for test data
            if (description.length > 100) {
              description = description.slice(0, 97) + "...";
            }

            // set new form values to either returned JSON book data if found
            // or if not available, use user's entered ata
            newForm.isbn.value = this.state.bookForm.isbn.value;
            newForm.title.value = title || newForm.title.value;
            newForm.author.value =
              authors.length > 0 ? authors[0] : newForm.author.value;
            newForm.description.value =
              description || newForm.description.value;
            newForm.image.value = imageLinks.thumbnail || newForm.image.value;

            // validate the form fields
            for (let input in newForm) {
              newForm[input].valid = validateInput(newForm[input]);
              isFormValid = newForm[input].valid && isFormValid;
            }

            this.setState({
              bookForm: newForm,
              isFormValid
            });
          }
        }
      })
      // not able to get book details, just keep user's input
      .catch(err => {});
  };

  handleBlurChanged = (_, input) => {
    if (
      input === "isbn" &&
      this.state.bookForm.isbn.valid &&
      this.state.bookForm.isbn.value.length !== 0
    ) {
      this.fetchBookDetails();
    }
  };

  handleInputChanged = (event, input) => {
    const newForm = { ...this.state.bookForm };
    if (newForm[input].elementConfig.type === "checkbox") {
      newForm[input].checked = event.target.checked;
    } else {
      newForm[input].value = event.target.value;
    }
    newForm[input].valid = validateInput(newForm[input]);
    newForm[input].touched = true;

    // if user enters a valid ISBN, try and fetch details
    if (
      input === "isbn" &&
      newForm[input].valid &&
      newForm[input].value.length !== 0
    ) {
      this.fetchBookDetails();
    }

    const isFormValid = validateForm(newForm);

    this.setState({ bookForm: newForm, isFormValid });
  };

  formSubmitHandler = event => {
    event.preventDefault();

    // check form app state isvalid again. CASE:
    // could modifiy the DOM disabled state on button
    if (!this.state.isFormValid) {
      return;
    }

    const { bookForm } = this.state;

    const newBook = {
      isbn: bookForm.isbn.value,
      title: bookForm.title.value,
      author: bookForm.author.value,
      description: bookForm.description.value,
      image: bookForm.image.value,
      loaned: bookForm.loaned.checked
    };

    // if updating a book, reuse same book id
    // else generate a new UUID
    if (this.props.book && this.props.book.id) {
      newBook.id = this.props.book.id;
      this.props.onUpdate(newBook, "PUT");
    } else {
      newBook.id = uuidv4();
      this.props.onUpdate(newBook, "POST");
    }
  };

  render = () => {
    // display error message if fetch() pushes error downstream
    let errorMessage = null;
    if (this.props.errorMessage) {
      errorMessage = <p className="error">ERROR: {this.props.errorMessage}</p>;
    }

    // convert object of input fields to
    // array so that can be mapped over
    const formElementsArray = [];
    for (const key in this.state.bookForm) {
      formElementsArray.push({
        id: key,
        config: this.state.bookForm[key]
      });
    }
    let form = (
      <form onSubmit={this.formSubmitHandler}>
        {formElementsArray.map(formElement => (
          <Input
            key={formElement.id}
            label={formElement.id}
            elementType={formElement.config.elementType}
            elementConfig={formElement.config.elementConfig}
            checked={formElement.config.checked}
            value={formElement.config.value}
            invalid={!formElement.config.valid}
            touched={formElement.config.touched}
            onBlurred={event => this.handleBlurChanged(event, formElement.id)}
            onChanged={event => this.handleInputChanged(event, formElement.id)}
          />
        ))}
        <Button btnType="cancel" clicked={this.props.onCancel}>
          Cancel
        </Button>
        <Button btnType="submit" disabled={!this.state.isFormValid}>
          {this.props.status}
        </Button>
      </form>
    );

    return (
      <div className={classes.BookSummary}>
        <h2>{this.props.status} Book</h2>
        {errorMessage}
        <div>
          <BookImage
            loaned={this.state.bookForm.loaned.checked}
            image={this.state.bookForm.image.value}
            title={this.state.bookForm.title.value}
          />
        </div>
        {form}
      </div>
    );
  };
}

BookSummary.propTypes = {
  book: PropTypes.shape({
    author: PropTypes.string.isRequired,
    description: PropTypes.string,
    id: PropTypes.string.isRequired,
    image: PropTypes.string,
    isbn: PropTypes.string,
    loaned: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired
  }),
  status: PropTypes.string.isRequired,
  onUpdate: PropTypes.func.isRequired,
  errorMessage: PropTypes.string
};

export default BookSummary;
