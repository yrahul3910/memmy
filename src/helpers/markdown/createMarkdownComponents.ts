import React, { createElement, FunctionComponentElement } from 'react';
import { MdToken } from '@src/types';
import {
  markdownComponentFontProps,
  markdownComponentFontTypes,
  markdownComponentMap,
  markdownComponentTypes,
} from '@helpers/markdown/markdownComponentMap';

let componentStyle = {};
let otherProps = {};

export const createMarkdownComponents = (
  mdObjArr: MdToken[],
): Array<React.FunctionComponentElement<any> | null> => {
  const components: Array<React.FunctionComponentElement<any> | null> = [];

  for (const token of mdObjArr) {
    let children: Array<React.FunctionComponentElement<any> | null> = [];

    if (token.children != null && token.children.length > 0) {
      children = createMarkdownComponents(token.children);
    }

    const component = createMarkdownComponent(token, children);
    components.push(component);
  }

  return components;
};

const createMarkdownComponent = (
  token: MdToken,
  children: Array<React.FunctionComponentElement<any> | null>,
): FunctionComponentElement<any> | null => {
  if (!markdownComponentTypes.includes(token.type)) {
    if (markdownComponentFontTypes.includes(token.type)) {
      componentStyle = {
        ...componentStyle,
        ...markdownComponentFontProps[token.type],
      };
    }

    if (token.type === 'link_open') {
      console.log('Found a link.');

      otherProps = {
        ...otherProps,
        href: token.attrs[0][1],
        link: true,
      };
    }
    return null;
  }

  const element = createElement(
    markdownComponentMap[token.type],
    {
      token,
      style: componentStyle,
      ...otherProps,
    },
    children,
  );

  if (Object.keys(componentStyle).length > 0) {
    componentStyle = {};
  }

  if (Object.keys(otherProps).length > 0) {
    otherProps = {};
  }

  return element;
};
